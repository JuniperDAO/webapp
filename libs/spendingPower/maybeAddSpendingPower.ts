import { CardAccount, Intent } from '@prisma/client'
import { getSessionSignerByOwnerId } from '../zerodev/server'
import { pollForERC20BalanceChange } from '../util/pollForBalanceChange'
import { AaveLoanInfo } from '../borrow/AaveLoanInfo'
import { parseEther } from 'ethers/lib/utils'
import { borrowUSD } from '../lineSetup/borrowUSD'
import { log } from '../util/log'
import { toEth, toWei, bigMin } from '../util/toEth'
import { getERC20Balance, getAllStableBalances } from '../util/getERC20Balance'
import { ERC20Send } from '../send/ERC20Send'
import { BigNumber } from 'ethers'
import { txnsToUserOp } from '../zerodev'
import { SessionKeySigner } from '../zerodev/SessionKeySigner'
import {
    AAVE_BORROW_TIMEOUT_MS,
    AAVE_SUPPORTED_STABLES,
    RAKE_BY_PROVIDER,
    DEFAULT_RAKE,
    MIN_RAKE_USD,
    USDC_PRECISION_FIXED,
    TUNGSTEN_ACCOUNTS_RECEIVABLE,
    safeStringify,
} from '../constants'
import { Network } from '../network/types'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

/**
 * This function sends a token with a user operation.
 * It takes the signer, token address, amount in wei, and receive address as parameters.
 * It creates an instance of ERC20Send with the token address and signer.
 * Then, it prepares the transaction to send the specified amount of tokens to the receive address.
 * It converts the transaction into a user operation and sends it using the signer.
 * Finally, it logs the details of the sent transaction.
 *
 * @param signer The SessionKeySigner instance used to sign the transaction.
 * @param tokenAddress The address of the token to be sent.
 * @param amountWei The amount of tokens to be sent in wei.
 * @param receiveAddress The address to receive the tokens.
 * @returns The result of the user operation.
 */

export const sendTokenWithUserOperation = async (signer: SessionKeySigner, tokenAddress: string, amountWei: BigNumber, receiveAddress: string) => {
    const sender = new ERC20Send(tokenAddress, signer)

    const tx = await sender.prepareSend(amountWei, receiveAddress)

    const userOp = txnsToUserOp([tx])
    console.log('sendTokenWithUserOperation userOp', userOp)
    return await signer.sendUserOperation(userOp[0])
}

export const addSpendingPower = async (senderUserId: string, destinationAddress: string, amountToAddUSD: number, provider: string = null) => {
    const signer = await getSessionSignerByOwnerId(senderUserId)
    const borrowerAddress = await signer.getAddress()
    const amountToAddUSDWei = parseEther(amountToAddUSD.toFixed(USDC_PRECISION_FIXED))
    const scwBalanceUSDStableWei = await getAllStableBalances(borrowerAddress, Network.optimism)

    log(`${borrowerAddress} has $${scwBalanceUSDStableWei} of ${amountToAddUSDWei} USDC.n requested`)

    // target amount to borrow is how much we want to borrow before any safety calculations
    // subtract the balance of the SCW to get the amount we need to borrow so that it is swept
    // 99% of the stable balance due to swap slippage
    let amountToBorrowUSDCnWei = amountToAddUSDWei.sub(scwBalanceUSDStableWei)
    if (amountToBorrowUSDCnWei.gt(0)) {
        const loanInfo = new AaveLoanInfo(borrowerAddress)
        const accountInfoUSD = await loanInfo.getAccountInfoUSD()
        log(`${borrowerAddress} borrowing $${toEth(amountToBorrowUSDCnWei)} params`, {
            destinationAddress,
            senderUserId,
            scwAddress: borrowerAddress,
            accountInfoUSD: accountInfoUSD,
        })
        const { availableBorrowsUSD } = accountInfoUSD
        const totalSpendableUSD = availableBorrowsUSD + toEth(scwBalanceUSDStableWei)

        // we could be retrying, so we need to check if we have enough to borrow
        if (amountToAddUSD >= totalSpendableUSD) {
            throw new Error(
                `Not enough available borrows or stables to add spending power: ${amountToAddUSD} >= ${totalSpendableUSD} (${availableBorrowsUSD} + ${toEth(scwBalanceUSDStableWei)})`
            )
        }

        // assess the rake on borrowed funds only
        const rake = RAKE_BY_PROVIDER[provider] || DEFAULT_RAKE
        // percentages are hard in BigNumbers
        let rakeToTakeUSDCWei = amountToBorrowUSDCnWei.mul(BigNumber.from(rake * 10000)).div(BigNumber.from(10000))

        if (rakeToTakeUSDCWei.lt(toWei(MIN_RAKE_USD.toFixed(USDC_PRECISION_FIXED)))) {
            log(`${borrowerAddress} rake amount on $${toEth(amountToBorrowUSDCnWei)} too small ($${toEth(rakeToTakeUSDCWei)} < $${MIN_RAKE_USD}), skipping`)
            rakeToTakeUSDCWei = BigNumber.from(0)
        } else if (toEth(amountToBorrowUSDCnWei) + toEth(rakeToTakeUSDCWei) >= availableBorrowsUSD) {
            log(
                `${borrowerAddress} rake amount on $${toEth(amountToBorrowUSDCnWei)} would exceed available borrow ($${toEth(rakeToTakeUSDCWei)} + ${toEth(amountToBorrowUSDCnWei)} >= $${availableBorrowsUSD}), skipping`
            )
            rakeToTakeUSDCWei = BigNumber.from(0)
        } else {
            log(`${borrowerAddress} rake amount (${rake}) on $${toEth(amountToBorrowUSDCnWei)} is $${toEth(rakeToTakeUSDCWei)}`)
        }

        amountToBorrowUSDCnWei = amountToBorrowUSDCnWei.add(rakeToTakeUSDCWei)

        log(`${borrowerAddress} amountToBorrowUSDCWei (with optional rake): $${toEth(amountToBorrowUSDCnWei)} of $${amountToAddUSD} to send`)

        // actually borrow. note the timeout
        await borrowUSD({
            optimismSigner: signer,
            desiredAmountWei: amountToBorrowUSDCnWei,
            timeoutAfter: AAVE_BORROW_TIMEOUT_MS,
        })

        if (rakeToTakeUSDCWei.gt(0)) {
            log(`${borrowerAddress} sending ${toEth(rakeToTakeUSDCWei)} USDC.n to treasury at ${TUNGSTEN_ACCOUNTS_RECEIVABLE}`)
            await sendTokenWithUserOperation(signer, AaveV3Optimism.ASSETS.USDCn.UNDERLYING, rakeToTakeUSDCWei, TUNGSTEN_ACCOUNTS_RECEIVABLE)
        }
    }

    let amountRemainingToSend = amountToAddUSDWei
    let txids = {}
    for (const stable of AAVE_SUPPORTED_STABLES) {
        // check the balance of the token we're sending
        const balance = await getERC20Balance(borrowerAddress, Network.optimism, AaveV3Optimism.ASSETS[stable].UNDERLYING)
        log(`${borrowerAddress} has ${balance} ${stable} to send, remaining ${amountRemainingToSend} to send`)

        if (balance.gt(0)) {
            const amountToSend = bigMin(balance, amountRemainingToSend)

            log(`${borrowerAddress} sending ${amountToSend} ${stable} to ${provider} at ${destinationAddress}`)
            txids[stable] = await sendTokenWithUserOperation(signer as any, AaveV3Optimism.ASSETS[stable].UNDERLYING, amountToSend, destinationAddress)

            amountRemainingToSend = amountRemainingToSend.sub(amountToSend)
        }
    }

    log(`${borrowerAddress} flow completed: ${safeStringify(txids)}`)
    return txids
}

export const addSpendingPowerToCard = async (cardAccount: CardAccount, amountToAddUSD: number) => {
    log(`${cardAccount.ownerId} Adding $${amountToAddUSD} spending power to card ${cardAccount.id}`)
    return addSpendingPower(cardAccount.ownerId, cardAccount.address, amountToAddUSD, cardAccount.provider)
}
