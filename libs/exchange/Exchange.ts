import { Signer, BigNumber, PopulatedTransaction } from 'ethers'

export type SwapTransactions = {
    approvalTxn: PopulatedTransaction
    swapTxn: PopulatedTransaction
}

export type PrepareSwapArgs = {
    amount: BigNumber
    fromTokenAddress: string
    toTokenAddress: string
    fromDecimals?: number
    toDecimals?: number
}

export abstract class Exchange {
    protected signer: Signer

    constructor(signer: Signer) {
        this.signer = signer
    }

    // should return a list of transactions to
    // be sent via executeBatch
    abstract prepareSwap({ amount, fromTokenAddress, toTokenAddress, fromDecimals, toDecimals }: PrepareSwapArgs): Promise<SwapTransactions>
}
