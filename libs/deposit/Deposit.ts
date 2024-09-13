import { BigNumber, PopulatedTransaction, Signer } from 'ethers'

export type DepositResult = {
    approvalTx: PopulatedTransaction
    depositTx: PopulatedTransaction
}

export abstract class Deposit {
    protected signer: Signer

    constructor(signer: Signer) {
        this.signer = signer
    }

    abstract prepareDeposit(amountWei: BigNumber): Promise<DepositResult>
}
