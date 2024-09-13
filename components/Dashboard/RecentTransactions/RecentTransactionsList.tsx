import Transaction from '@/components/Reusable/Transaction'
import { TransactionsContext } from '@/context/Transactions/TransactionsContext'
import { useContext } from 'react'
import { TransactionsListSkeleton } from './Skeleton'

const threeArr = [0, 1, 2]

export const RecentTransactionsList = ({ onTransactionClick }) => {
    const { isLoadingInitial, txnsByMonth } = useContext(TransactionsContext)

    if (isLoadingInitial) return <TransactionsListSkeleton type="small" />

    return (
        <>
            {threeArr.map((_, i) => {
                const tx = txnsByMonth[0]?.transactions && txnsByMonth[0]?.transactions[i]
                if (!tx) return null

                return <Transaction key={`recent-tx-${tx.transactionHash}`} txn={tx} onClick={onTransactionClick} />
            })}
        </>
    )
}
