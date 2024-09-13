import { BigNumber } from 'ethers'
import { ERC20_ABI } from '../exchange/ERC20Abi'
import { ethers, Signer } from 'ethers'
import { weiToTokenDecimals } from '../util/units'

/**
 * This class is used to send ERC20 tokens to another address
 * UNITS accepted are in WEI!!
 */
export class ERC20Send {
    assetAddress: string
    signer: Signer
    erc20Contract: ethers.Contract
    constructor(assetAddress: string, signer: Signer) {
        this.assetAddress = assetAddress
        this.signer = signer

        this.erc20Contract = new ethers.Contract(this.assetAddress, ERC20_ABI, this.signer)
    }

    async prepareSend(amountWei: BigNumber, recipientAddress: string) {
        // usdc uses 6 decimals, so we need to convert
        const amountTokenDecimals = weiToTokenDecimals(amountWei, this.assetAddress)

        const tx = await this.erc20Contract.populateTransaction.transfer(recipientAddress, amountTokenDecimals)

        return tx
    }
}
