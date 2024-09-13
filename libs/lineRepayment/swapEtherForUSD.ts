import { BigNumber } from 'ethers'
import { toEth } from '../util/toEth'
import { prepareWrapTxn } from '../wrap/prepareWrapTxn'
import { log } from '../util/log'
import { UniswapExchange } from '../exchange/UniswapExchange'
import { getERC20Balance } from '../util/getERC20Balance'
import { Network } from '../network/types'
import { txnsToUserOp } from '../zerodev'
import { pollForERC20BalanceChange } from '../util/pollForBalanceChange'
import { SessionKeySigner } from '../zerodev/SessionKeySigner'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

// wraps the ether and swaps it for
// USDC on optimism, then returns the optimism balance
// inspired by wrapAndSwapForWSteth.ts
export const swapEtherForUSD = async (ethAmountWei: BigNumber, optimismSigner: SessionKeySigner): Promise<BigNumber> => {
    const walletAddress = await optimismSigner.getAddress()

    log('Eth amount to swap:', toEth(ethAmountWei))

    if (ethAmountWei.eq(0)) {
        log('Zero amount of eth to swap for USD')
        throw new Error('Zero amount of eth to swap for USD')
    }

    /*
     * STEP 1: Wrap Optimism ETH to WETH
     */
    const wrapTxn = await prepareWrapTxn(ethAmountWei)

    log('Wrap txn:', wrapTxn)

    /**
     * STEP 2: Swap WETH for USDC
     */
    const uni = new UniswapExchange(optimismSigner)

    const { approvalTxn, swapTxn } = await uni.prepareSwap({
        amount: ethAmountWei,
        fromTokenAddress: AaveV3Optimism.ASSETS.WETH.UNDERLYING,
        toTokenAddress: AaveV3Optimism.ASSETS.USDCn.UNDERLYING,
    })

    log('Exchange Txns', approvalTxn, swapTxn)

    const usdcBalanceBeforeSwap = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS.USDCn.UNDERLYING)

    log('USDC balance before swap:', toEth(usdcBalanceBeforeSwap))

    /**
     * STEP 3: perform the transactions
     */
    try {
        // wraps eth to WETH and swaps it all in one batch txn
        const userOp = txnsToUserOp([wrapTxn, approvalTxn, swapTxn])
        const response = await optimismSigner.sendUserOperation(userOp)
        log('Response from wrap and swap', response)
    } catch (e) {
        log('Failure to wrap and swap ', e)
        throw e
    }

    /**
     * STEP 4: wait for usdc balance to update
     */
    const { didTimeOut: didUSDCTimeout, currentBalance } = await pollForERC20BalanceChange({
        signer: optimismSigner,
        tokenAddress: AaveV3Optimism.ASSETS.USDCn.UNDERLYING,
        overrideOriginalBalance: usdcBalanceBeforeSwap,
    })

    if (didUSDCTimeout) {
        log('Timed out waiting for USDC balance change after swap')
        throw new Error('Timed out waiting for USDC balance change after swap')
    }

    const usdcDepositAmount = currentBalance.sub(usdcBalanceBeforeSwap)

    return usdcDepositAmount
}
