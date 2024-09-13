import { prepareWrapTxn } from '../wrap/prepareWrapTxn'
import { UniswapExchange } from '../exchange/UniswapExchange'
import { log } from '../util/log'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { getERC20Balance } from '../util/getERC20Balance'
import { pollForERC20BalanceChange } from '../util/pollForBalanceChange'
import { toEth } from '../util/toEth'
import { Network } from '../network/types'
import { txnsToUserOp } from '../zerodev'
import { SessionKeySigner } from '../zerodev/SessionKeySigner'

// returns either { ETH: pre-swap, wstETH:post-swap } || {}
export const wrapAndSwapForWSteth = async (optimismSigner: SessionKeySigner) => {
    const ethBalanceOp = await optimismSigner.getBalance()
    const walletAddress = await optimismSigner.getAddress()

    const wethbalanceBeforeWrap = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS.WETH.UNDERLYING)
    if (ethBalanceOp.gt(0)) {
        log('found raw ETH balance on optimism, wrapping:', toEth(ethBalanceOp))
        const wrapTxn = await prepareWrapTxn(ethBalanceOp)
        const userOp = txnsToUserOp([wrapTxn])
        const response = await optimismSigner.sendUserOperation(userOp)
        log('Response from ETH -> WETH wrap', response)

        const { didTimeOut: didWETHTimeout } = await pollForERC20BalanceChange({
            signer: optimismSigner,
            tokenAddress: AaveV3Optimism.ASSETS.WETH.UNDERLYING,
            overrideOriginalBalance: wethbalanceBeforeWrap,
        })

        if (didWETHTimeout) {
            throw new Error('Timed out waiting for WETH balance change after swap')
        }
    }

    const wethbalanceBeforeSwap = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS.WETH.UNDERLYING)
    if (wethbalanceBeforeSwap.gt(0)) {
        log('found WETH balance on optimism, swapping for wstETH:', toEth(wethbalanceBeforeSwap))
        const uni = new UniswapExchange(optimismSigner)
        const { approvalTxn, swapTxn } = await uni.prepareSwap({
            amount: wethbalanceBeforeSwap,
            fromTokenAddress: AaveV3Optimism.ASSETS.WETH.UNDERLYING,
            toTokenAddress: AaveV3Optimism.ASSETS.wstETH.UNDERLYING,
        })

        const wstethbalanceBeforeSwap = await getERC20Balance(walletAddress, Network.optimism, AaveV3Optimism.ASSETS.wstETH.UNDERLYING)
        log('wstETH balance before swap:', toEth(wstethbalanceBeforeSwap))

        const approvalResponse = await optimismSigner.sendUserOperation(txnsToUserOp([approvalTxn]))
        log('Response from approval', approvalResponse)

        const swapResponse = await optimismSigner.sendUserOperation(txnsToUserOp([swapTxn]))
        log('Response from swap', swapResponse)

        const { currentBalance, didTimeOut: disWstethTimeout } = await pollForERC20BalanceChange({
            signer: optimismSigner,
            tokenAddress: AaveV3Optimism.ASSETS.wstETH.UNDERLYING,
            overrideOriginalBalance: wstethbalanceBeforeSwap,
        })

        if (disWstethTimeout) {
            throw new Error('Timed out waiting for wstETH balance change after swap')
        }

        return { ETH: ethBalanceOp, wstETH: currentBalance }
    }
}
