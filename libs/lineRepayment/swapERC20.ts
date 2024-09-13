import { BigNumber } from 'ethers'
import { toEth, bigMin } from '../util/toEth'
import { log } from '../util/log'
import { UniswapExchange } from '../exchange/UniswapExchange'
import { getERC20Balance, getAllStableBalances } from '../util/getERC20Balance'
import { Network } from '../network/types'
import { txnsToUserOp } from '../zerodev'
import { tokenToDecimals, weiToTokenDecimals } from '../util/units'
import { SessionKeySigner } from '../zerodev/SessionKeySigner'
import { AAVE_SUPPORTED_STABLES, ONE_DOLLAR, safeStringify } from '../constants'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

export type SwapArgs = {
    fromTokenAmountWei: BigNumber
    fromTokenAddress: string
    toTokenAddress: string
    optimismSigner: SessionKeySigner
}

export const swapERC20 = async ({ fromTokenAmountWei, fromTokenAddress, toTokenAddress, optimismSigner }: SwapArgs): Promise<BigNumber> => {
    const walletAddress = await optimismSigner.getAddress()

    log(`${walletAddress} Token amount to swap: ${fromTokenAmountWei}`)

    const uni = new UniswapExchange(optimismSigner)

    const localDecimalAmount = weiToTokenDecimals(fromTokenAmountWei, fromTokenAddress)

    const { approvalTxn, swapTxn } = await uni.prepareSwap({
        amount: localDecimalAmount,
        fromTokenAddress: fromTokenAddress,
        toTokenAddress,
        fromDecimals: tokenToDecimals(fromTokenAddress),
        toDecimals: tokenToDecimals(toTokenAddress),
    })

    log(`${walletAddress} Exchange Txns: ${approvalTxn}, ${swapTxn}`)

    const toTokenBalanceBeforeSwap = await getERC20Balance(walletAddress, Network.optimism, toTokenAddress)

    log(`${walletAddress} To balance before swap: ${toTokenBalanceBeforeSwap}`)

    /**
     * perform the transactions
     */
    try {
        const userOp = txnsToUserOp([approvalTxn, swapTxn])
        const response = await optimismSigner.sendUserOperation(userOp)
        log(`${walletAddress} OK wrap and swap: ${safeStringify(response)}`)
    } catch (e) {
        log(`${walletAddress} ERR wrap and swap: ${e}`)
        throw e
    }

    return await getERC20Balance(walletAddress, Network.optimism, toTokenAddress)
}

export const swapStablesForStable = async (
    amountWei: BigNumber,
    optimismSigner: SessionKeySigner,
    inputStables = AAVE_SUPPORTED_STABLES,
    outputStable = 'USDCn'
): Promise<BigNumber> => {
    const walletAddress = await optimismSigner.getAddress()
    let allStableBalances = await getAllStableBalances(walletAddress, Network.optimism)
    let outputBalance = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS[outputStable].UNDERLYING)

    for (const inputSymbol of inputStables) {
        if (inputSymbol === outputStable) {
            continue
        }
        if (!AaveV3Optimism.ASSETS[inputSymbol].UNDERLYING) {
            throw new Error(`${walletAddress} no underlying for ${inputSymbol}`)
        }

        const inputBalance = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS[inputSymbol].UNDERLYING)
        // $0.20 bullshit threshold
        const min = bigMin(ONE_DOLLAR.div(5), amountWei)
        if (inputBalance.lte(min)) {
            log(`${walletAddress} skipping ${inputSymbol} with balance ${inputBalance} < ${min}`)
            continue
        }

        // if we're done, break
        const amountRemainingToSwap = amountWei.sub(outputBalance)
        if (amountRemainingToSwap.lte(0)) {
            break
        }

        // swap 1% more than we need to account for slippage
        let amountToSwap = amountRemainingToSwap.mul(101).div(100)

        // if that'd exceed the input balance, clamp it
        if (amountToSwap.gt(inputBalance)) {
            amountToSwap = inputBalance
        }

        log(`${walletAddress} swapping ${amountToSwap} of ${inputSymbol} to get ${amountRemainingToSwap}/${amountWei} ${outputStable}`)
        await swapERC20({
            fromTokenAmountWei: amountToSwap,
            fromTokenAddress: AaveV3Optimism.ASSETS[inputSymbol].UNDERLYING,
            toTokenAddress: AaveV3Optimism.ASSETS[outputStable].UNDERLYING,
            optimismSigner: optimismSigner,
        })

        outputBalance = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS[outputStable].UNDERLYING)
    }

    return outputBalance
}
