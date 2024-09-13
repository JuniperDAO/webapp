import { Signer, ethers, BigNumber } from 'ethers'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { AAVE_ENCODER_ABI } from '../deposit/AaveEncoderABI'
import { getReadProvider } from '../getReadProvider'
import { Network } from '../network/types'
import { getERC20Balance } from '../util/getERC20Balance'
import { AAVE_POOL_ABI } from '../deposit/AavePoolABI'
import { log } from '../util/log'
import { toEth, toWei } from '../util/toEth'

export class AaveWithdraw {
    signer: Signer

    constructor(signer: Signer) {
        this.signer = signer
    }

    async prepareWithdrawAll(symbol, info) {
        const address = await this.signer.getAddress()
        const fullCollateralBalance = await getERC20Balance(address, Network.optimism, info.A_TOKEN)
        if (fullCollateralBalance.gt(0)) {
            // const baseTricks = toEth(fullCollateralBalance)
            // const nDigitsFixed = baseTricks.toFixed(7)
            // const nDigitsCollateralBalance = toWei(nDigitsFixed)

            // log(`Withdrawing ${info.UNDERLYING} collateral available balance of ${nDigitsFixed}`)

            // const encodedParams = await this.getEncodedParams(info.UNDERLYING, nDigitsCollateralBalance)
            log(`Withdrawing ${symbol} collateral available balance of ${toEth(fullCollateralBalance)}`)

            const encodedParams = await this.getEncodedParams(info.UNDERLYING, fullCollateralBalance)

            const pool = new ethers.Contract(AaveV3Optimism.POOL, AAVE_POOL_ABI)
            const preparedTxn = await pool.populateTransaction['withdraw(bytes32)'](encodedParams)

            return preparedTxn
        } else {
            log(`No ${symbol} to withdraw`)
            return null
        }
    }

    async getEncodedParams(assetAddress, amountWei: BigNumber) {
        const encoder = new ethers.Contract(AaveV3Optimism.L2_ENCODER, AAVE_ENCODER_ABI, getReadProvider(Network.optimism))
        const encoded = await encoder.encodeWithdrawParams(assetAddress, amountWei)

        return encoded
    }
}
