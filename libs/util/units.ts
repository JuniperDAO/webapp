import { BigNumber } from 'ethers'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

export const tokenToDecimals = (tokenAddress: string): number => {
    switch (tokenAddress) {
        case AaveV3Optimism.ASSETS.USDC.UNDERLYING:
        case AaveV3Optimism.ASSETS.USDC.A_TOKEN:
        case AaveV3Optimism.ASSETS.USDC.V_TOKEN:
        case AaveV3Optimism.ASSETS.USDCn.UNDERLYING:
        case AaveV3Optimism.ASSETS.USDCn.A_TOKEN:
        case AaveV3Optimism.ASSETS.USDCn.V_TOKEN:
        case AaveV3Optimism.ASSETS.USDT.UNDERLYING:
        case AaveV3Optimism.ASSETS.USDT.A_TOKEN:
        case AaveV3Optimism.ASSETS.USDT.V_TOKEN:
        case AaveV3Optimism.ASSETS.DAI.UNDERLYING:
        case AaveV3Optimism.ASSETS.DAI.A_TOKEN:
        case AaveV3Optimism.ASSETS.DAI.V_TOKEN:
        case AaveV3Optimism.ASSETS.LUSD.UNDERLYING:
        case AaveV3Optimism.ASSETS.LUSD.A_TOKEN:
        case AaveV3Optimism.ASSETS.LUSD.V_TOKEN:
            return 6
        default:
            return 18
    }
}

export const weiToTokenDecimals = (amountWei: BigNumber, tokenAddress: string): BigNumber => {
    const weiDecimals = 18
    const tokenDecimals = tokenToDecimals(tokenAddress)
    const divisor = BigNumber.from(10).pow(weiDecimals - tokenDecimals)

    const amountWithTokenDecimals = amountWei.div(divisor)

    return amountWithTokenDecimals
}

export const tokenDecimalsToWei = (amountWithTokenDecimals: BigNumber, tokenAddress: string): BigNumber => {
    const weiDecimals = 18
    const tokenDecimals = tokenToDecimals(tokenAddress)
    const multiplier = BigNumber.from(10).pow(weiDecimals - tokenDecimals)

    const amountWei = amountWithTokenDecimals.mul(multiplier)

    return amountWei
}
