import { Deposit, DepositResult } from './Deposit'
import { ethers, BigNumber, Signer, PopulatedTransaction } from 'ethers'
import { ERC20_ABI } from '../exchange/ERC20Abi'
import { getReadProvider } from '../getReadProvider'
import { AAVE_ENCODER_ABI } from './AaveEncoderABI'
import { AAVE_POOL_ABI } from './AavePoolABI'
import { Network } from '../network/types'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

// NOTE: this uses L2Pool, which is optimized to minimize
// calldata and save gas on L2 protocols
export class AaveDeposit extends Deposit {
    assetAddress: string

    constructor(signer: Signer, assetAddress: string) {
        super(signer)
        this.assetAddress = assetAddress
    }

    public async prepareDeposit(amountWei: BigNumber): Promise<DepositResult> {
        const approvalTx = await this.getTokenApprovalTx(amountWei)
        const encodedParams = await this.getEncodedParams(amountWei)

        const pool = new ethers.Contract(AaveV3Optimism.POOL, AAVE_POOL_ABI)

        const depositTx = await pool.populateTransaction['supply(bytes32)'](encodedParams)

        return {
            approvalTx,
            depositTx,
        }
    }

    private async getEncodedParams(amountWei: BigNumber) {
        const encoder = new ethers.Contract(AaveV3Optimism.L2_ENCODER, AAVE_ENCODER_ABI, getReadProvider(Network.optimism))

        const referralCode = 0 // TODO: tungsten referral code??

        const encoded = await encoder.encodeSupplyParams(this.assetAddress, amountWei, referralCode)

        return encoded
    }

    private async getTokenApprovalTx(amountWei: BigNumber): Promise<PopulatedTransaction> {
        const asset = new ethers.Contract(this.assetAddress, ERC20_ABI, this.signer)

        return await asset.populateTransaction.approve(AaveV3Optimism.POOL, amountWei)
    }
}
