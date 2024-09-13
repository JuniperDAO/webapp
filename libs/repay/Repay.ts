import { Signer, PopulatedTransaction, BigNumber } from 'ethers'

export type RepayResult = {
    approvalTx: PopulatedTransaction
    repayTx: PopulatedTransaction
}

export abstract class Repay {
    protected signer: Signer

    constructor(signer: Signer) {
        this.signer = signer
    }

    abstract prepareRepay(assetAddress: string, amountWei: BigNumber): Promise<RepayResult>
}
