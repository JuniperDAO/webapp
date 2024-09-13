import { Signer, PopulatedTransaction, BigNumber, ethers } from 'ethers'
import { Borrow } from './Borrow'
import { AAVE_POOL_ABI } from '../deposit/AavePoolABI'
import { getReadProvider } from '../getReadProvider'
import { AAVE_ENCODER_ABI } from '../deposit/AaveEncoderABI'
import { Network } from '../network/types'
import { weiToTokenDecimals } from '../util/units'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

export class AaveBorrow extends Borrow {
    aavePool: ethers.Contract

    constructor(signer: Signer) {
        super(signer)

        this.aavePool = new ethers.Contract(AaveV3Optimism.POOL, AAVE_POOL_ABI, getReadProvider(Network.optimism))
    }

    public async prepareBorrow(assetAddress: string, amountWei: BigNumber): Promise<PopulatedTransaction> {
        const encodedParams = await this.getEncodedBorrowParams(assetAddress, amountWei)

        const borrowTx = await this.aavePool.populateTransaction['borrow(bytes32)'](encodedParams)

        return borrowTx
    }

    // encoding params into bytes32 is more gas efficient
    // on l2s because it saves on calldata
    private async getEncodedBorrowParams(assetAddress: string, amountWei: BigNumber) {
        const contract = new ethers.Contract(AaveV3Optimism.L2_ENCODER, AAVE_ENCODER_ABI, getReadProvider(Network.optimism))

        const variableInterestRateMode = 2
        const blankReferralCode = 0

        // different ERC20s have different decimals, so we need to account for that
        // NOTE: this may result in loss of precision
        const tokenDecimalAmount = weiToTokenDecimals(amountWei, assetAddress)

        const encodedParams = await contract.encodeBorrowParams(assetAddress, tokenDecimalAmount, variableInterestRateMode, blankReferralCode)

        return encodedParams
    }
}
