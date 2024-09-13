import { Signer, PopulatedTransaction, BigNumber, ethers } from 'ethers'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { Repay, RepayResult } from './Repay'
import { AAVE_POOL_ABI } from '../deposit/AavePoolABI'
import { getReadProvider } from '../getReadProvider'
import { AAVE_ENCODER_ABI } from '../deposit/AaveEncoderABI'
import { ERC20_ABI } from '../exchange/ERC20Abi'
import { Network } from '../network/types'
import { weiToTokenDecimals } from '../util/units'
import { getERC20Balance } from '../util/getERC20Balance'

export class AaveRepay extends Repay {
    constructor(signer: Signer) {
        super(signer)
    }

    public async prepareRepay(assetAddress: string, amountWei: BigNumber): Promise<RepayResult> {
        if (amountWei.isZero()) {
            throw new Error('Cannot repay 0')
        }

        const pool = new ethers.Contract(AaveV3Optimism.POOL, AAVE_POOL_ABI)

        const tokenDecimalAmount = weiToTokenDecimals(amountWei, assetAddress)

        const approvalTx = await this.getERC20ApprovalTx(assetAddress, tokenDecimalAmount, AaveV3Optimism.POOL)

        const encodedParams = await this.getEncodedRepayParams(assetAddress, tokenDecimalAmount)

        const repayTx = await pool.populateTransaction['repay(bytes32)'](encodedParams)

        return {
            repayTx,
            approvalTx,
        }
    }

    private async getERC20ApprovalTx(assetAddress: string, tokenDecimalAmount: BigNumber, spender: string): Promise<PopulatedTransaction> {
        const erc20 = new ethers.Contract(assetAddress, ERC20_ABI, this.signer)

        const approvalTx = await erc20.populateTransaction.approve(spender, tokenDecimalAmount)

        return approvalTx
    }

    private async hasStableInterestDebt(): Promise<boolean> {
        const address = await this.signer.getAddress()
        const balance = await getERC20Balance(address, Network.optimism, AaveV3Optimism.ASSETS.USDC.S_TOKEN)

        return balance.gt(0)
    }

    // encoding params into bytes32 is more gas efficient
    // on l2s because it saves on calldata
    private async getEncodedRepayParams(assetAddress: string, tokenDecimalAmount: BigNumber) {
        const contract = new ethers.Contract(AaveV3Optimism.L2_ENCODER, AAVE_ENCODER_ABI, getReadProvider(Network.optimism))

        // TODO - remove once all stable interest rate debt is repaid
        const hasStableInterestDebt = await this.hasStableInterestDebt()

        const stableInterestRateMode = hasStableInterestDebt ? 1 : 2

        const encodedParams = await contract.encodeRepayParams(assetAddress, tokenDecimalAmount, stableInterestRateMode)

        return encodedParams
    }
}
