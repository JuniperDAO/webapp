import { AccountDataUSD } from '@/libs/borrow/AaveLoanInfo'

export type CreditLineProps = AccountDataUSD & {
    totalIdleUSD: number
    maxSpendingPowerUSD: number
    isLoading: boolean
    error: ''
    refreshLoanInfo: (address: string) => Promise<void>
    cancelRefreshLoanInfo: () => void
}
