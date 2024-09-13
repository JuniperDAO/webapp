import styles from '@/styles/Home.module.css'
import RightIcon from '@/public/icons/RightIcon'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { TransactionsContext } from '@/context/Transactions/TransactionsContext'
import { SpendingChart } from './SpendingChart'
import { RecentTransactionsList } from './RecentTransactionsList'
import { formatMoney } from '@/libs/util/formatMoney'
import { analytics } from '@/libs/evkv'
import { formatMonthForDisplay } from '@/libs/util/time'

export default function RecentTransactions({ setTransactionData }) {
    const { txnsByMonth, rawTxns, isLoadingInitial, isPaginating } = useContext(TransactionsContext)
    const [totalSpend, setTotalSpend] = useState<string>('$0.00')
    const [monthLabel, setMonthLabel] = useState<string>('')

    const router = useRouter()

    const onTransactionClick = (data) => {
        analytics.track('recentTransactionClicked', { data: data })
        setTransactionData(data)
    }

    useEffect(() => {
        if (!txnsByMonth.length) return

        const firstMonth = txnsByMonth[0]
        const spend = firstMonth.totalSpend
        const spendFormatted = formatMoney(spend)

        setTotalSpend(spendFormatted)
        setMonthLabel(formatMonthForDisplay(firstMonth.startDate))
    }, [txnsByMonth])

    if (!isLoadingInitial && !isPaginating && !rawTxns.length) return null

    return (
        <div className={styles.transactions}>
            <div className="flex items-center justify-between p-4">
                {monthLabel && (
                    <>
                        <h3 className="text-xl spectral text-light">Recent Activity</h3>
                        <RightIcon
                            className="cursor-pointer"
                            onClick={() => {
                                analytics.track('recentTransactionsArrowClicked')
                                router.push('/dashboard/transactions')
                            }}
                        />
                    </>
                )}
            </div>
            <div className="flex items-center justify-between px-4 text-[#60645c] text-sm mb-4">
                {monthLabel && (
                    <>
                        <p>Spending in {monthLabel}</p>
                        <p>{totalSpend}</p>
                    </>
                )}
            </div>

            <SpendingChart />

            <RecentTransactionsList onTransactionClick={onTransactionClick} />
            <p
                onClick={() => {
                    analytics.track('recentTransactionsSeeAllClicked')
                    router.push('/dashboard/transactions')
                }}
                className="cursor-pointer py-2 text-center text-[14px] spectral">
                See All
            </p>
        </div>
    )
}
