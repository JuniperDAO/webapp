export enum JuniperTransactionType {
    Deposit = 'deposit', // when you add eth to your credit line
    Withdraw = 'withdraw', // when the user withdraws wstETH to an external address
    Repay = 'repay', // when you pay back stable to your credit line
    Spend = 'spend', // when the credit line is drawn and sent to the user's card account receiver address
    Fee = 'fee', // when the user pays a fee to us
    ReferralBonus = 'referral', // when the user completes a referral
}

export type JuniperTransaction = {
    type: JuniperTransactionType
    amount: number
    from: string
    to: string
    date: string
    transactionHash: string
    currency: string
}

export type CurrencyType = 'ETH' | 'WETH' | 'wstETH' | 'USDC' | 'AAVE' | 'LINK' | 'OP' | 'WBTC' | 'RETH' | 'USDC.e'

export function signForTransactionType(type: JuniperTransactionType): string {
    return type === JuniperTransactionType.Spend || type === JuniperTransactionType.Withdraw || type === JuniperTransactionType.Fee ? '-' : '+'
}
