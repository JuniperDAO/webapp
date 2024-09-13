import { Signer, PopulatedTransaction, BigNumber } from 'ethers'

export abstract class Borrow {
    protected signer: Signer

    constructor(signer: Signer) {
        this.signer = signer
    }

    abstract prepareBorrow(assetAddress: string, amountWei: BigNumber): Promise<PopulatedTransaction>
}
