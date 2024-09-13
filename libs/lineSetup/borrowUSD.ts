import { AaveBorrow } from '../borrow/AaveBorrow'
import { AAVE_BORROW_TIMEOUT_MS, safeStringify } from '../constants'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { log } from '../util/log'
import { toEth } from '../util/toEth'
import { getERC20Balance } from '../util/getERC20Balance'
import { pollForERC20BalanceChange } from '../util/pollForBalanceChange'
import { AaveLoanInfo } from '../borrow/AaveLoanInfo'
import { BigNumber } from 'ethers'
import { Network } from '../network/types'
import { txnsToUserOp } from '../zerodev'
import { SessionKeySigner } from '../zerodev/SessionKeySigner'
import * as Sentry from '@sentry/nextjs'

export type BorrowArgs = {
    optimismSigner: SessionKeySigner
    percentOfMaxLTV?: number
    desiredAmountWei?: BigNumber
    timeoutAfter?: number
}

export const borrowUSD = async ({ optimismSigner, percentOfMaxLTV, desiredAmountWei, timeoutAfter }: BorrowArgs) => {
    const walletAddress = await optimismSigner.getAddress()

    const aaveBorrow = new AaveBorrow(optimismSigner)
    const loanInfo = new AaveLoanInfo(walletAddress)

    let amountToBorrow = desiredAmountWei

    // fall back on the percent
    if (!amountToBorrow) {
        amountToBorrow = await loanInfo.getAvailableToBorrow({
            percentOfMaxLTV,
        })
    }

    if (!amountToBorrow || amountToBorrow.eq(0)) throw new Error('Must specify non zero amount to borrow')

    log(`${walletAddress} borrowing $${toEth(amountToBorrow)}`)

    const borrowTx = await aaveBorrow.prepareBorrow(AaveV3Optimism.ASSETS.USDCn.UNDERLYING, amountToBorrow)

    const usdcBalanceBeforeBorrow = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS.USDCn.UNDERLYING)

    log(`${walletAddress} USDC before borrowing $${toEth(usdcBalanceBeforeBorrow)}`)
    try {
        const userOp = txnsToUserOp([borrowTx])
        const res = await optimismSigner.sendUserOperation(userOp[0])
        log(`${walletAddress} userOperation sent $${safeStringify(res)}, waiting for confirmation`)
    } catch (e) {
        // 4337/paymaster failures may occur here
        log(`${walletAddress} userOperation failed ${e}}`)
        Sentry.captureException(e)
        throw e
    }

    /**
     * Wait for USDC balance to update
     */
    const { currentBalance: finalUSDCBalance, didTimeOut: didUSDCBorrowTimeout } = await pollForERC20BalanceChange({
        signer: optimismSigner,
        tokenAddress: AaveV3Optimism.ASSETS.USDCn.UNDERLYING,
        overrideOriginalBalance: usdcBalanceBeforeBorrow,
        timeoutAfter: timeoutAfter || AAVE_BORROW_TIMEOUT_MS,
    })

    if (didUSDCBorrowTimeout) {
        throw new Error(`Timed out (${(timeoutAfter || AAVE_BORROW_TIMEOUT_MS) / 1000}s) when polling for borrow balance change`)
    }

    log(`${walletAddress} userOperation borrowed $${toEth(finalUSDCBalance)}`)

    return finalUSDCBalance
}
