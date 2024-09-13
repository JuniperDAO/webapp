import Layout from '@/components/Reusable/Layout'
import React, { useContext, useEffect, useState } from 'react'
import styles from '@/styles/Transactions.module.css'
import Transaction from '@/components/Reusable/Transaction'
import { IoIosArrowRoundBack } from 'react-icons/io'
import { TransactionModal } from '@/components/Modal/TransactionModal'
import { useRouter } from 'next/router'
import { TransactionsListSkeleton } from '@/components/Dashboard/RecentTransactions/Skeleton'
import { TransactionChunk } from '@/context/Transactions/TransactionChunker'
import { JuniperTransaction, JuniperTransactionType } from '@/libs/transactionHistory/types'
import { formatDateForDisplay } from '@/libs/util/time'
import { TransactionsContext } from '@/context/Transactions/TransactionsContext'
import { motion } from 'framer-motion'
import { header, page } from '@/libs/animate'
import { staticURL } from '@/libs/constants'
import { userContext } from '@/context/user/userContext'
import Link from 'next/link'
import { formatAddress } from '@/libs/util/formatAddress'

enum Filters {
    ALL,
    DEPOSIT,
    SEND,
    REPAY,
    WITHDRAW,
}

const filterToCopy = {
    SPENDING: 'Send',
}

const filterTxns = (txns: JuniperTransaction[], filter: Filters) => {
    return txns.filter((txn) => {
        if (filter == Filters.DEPOSIT) {
            return txn.type === JuniperTransactionType.Deposit
        } else if (filter == Filters.SEND) {
            return txn.type === JuniperTransactionType.Spend
        } else if (filter == Filters.REPAY) {
            return txn.type === JuniperTransactionType.Repay
        } else if (filter == Filters.WITHDRAW) {
            return txn.type === JuniperTransactionType.Withdraw
        }

        return true
    })
}

export default function Transactions() {
    const [modalData, setModalData] = useState(null)
    const [filter, setFilter] = useState<Filters>(Filters.ALL)
    const router = useRouter()
    const { user, smartWalletAddress } = useContext(userContext)
    const { isLoadingInitial, txnsByDay } = useContext(TransactionsContext)

    const [filteredTxns, setFilteredTxns] = useState<TransactionChunk[]>(txnsByDay)

    useEffect(() => {
        const newTxns = [
            ...txnsByDay
                .map((chunk) => {
                    return {
                        ...chunk,
                        transactions: filterTxns(chunk.transactions, filter),
                    }
                })
                .filter((chunk) => chunk.transactions.length > 0),
        ]

        setFilteredTxns(newTxns)
    }, [txnsByDay, filter])

    const onClose = () => {
        setModalData(null)
    }

    const onClick = (data: JuniperTransaction) => {
        setModalData(data)
    }

    return (
        <Layout>
            <div className={styles.container}>
                <img src={staticURL('/public/images/fullLeaf.png')} width={1512} height={450} alt="leaf" className="full-leaf hidden md:block" />
                <img width={200} height={174} src={staticURL('/public/images/rightLeaf.png')} alt="leaf" className="right-leaf md:hidden" />
                <motion.div initial="initial" animate="animate" exit="exit" variants={header} className={styles.header}>
                    <IoIosArrowRoundBack className={styles.backIcon} size={32} onClick={() => router.push('/dashboard')} />
                </motion.div>
                <motion.div className="flex items-center justify-end w-full">
                    <Link
                        className={'text-light text-xs w-max mb-2 pr-6 md:pr-0'}
                        href={`https://optimistic.etherscan.io/address/${smartWalletAddress}`}
                        passHref
                        target="_blank">
                        {formatAddress(smartWalletAddress)}
                    </Link>
                </motion.div>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    <div className={`flex mt-5 items-center px-4 gap-2 overflow-x-auto ${styles.filters}`}>
                        {['All', 'Deposit', 'Send', 'Repay', 'Withdraw'].map((f) => (
                            <button
                                key={`filter-${f}`}
                                onClick={() => {
                                    console.log(Filters[f.toUpperCase()])
                                    setFilter(Filters[f.toUpperCase()])
                                }}
                                className={filter == Filters[f.toUpperCase()] ? styles.isActive : ''}>
                                {filterToCopy[f.toUpperCase()] || f}
                            </button>
                        ))}
                    </div>

                    {isLoadingInitial ? (
                        <TransactionsListSkeleton type="big" />
                    ) : (
                        <div className={styles.transactions}>
                            {filteredTxns.map((chunk) => {
                                return (
                                    <DayTransactionsChunk
                                        key={`chunk-${chunk.startDate}`}
                                        chunk={chunk}
                                        onClick={(data) => {
                                            onClick(data)
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )}
                </motion.div>
            </div>
            <TransactionModal onClose={onClose} data={modalData} />
        </Layout>
    )
}

type DayTransactionsChunkProps = {
    chunk: TransactionChunk
    onClick: (txn: JuniperTransaction) => void
}

const DayTransactionsChunk: React.FC<DayTransactionsChunkProps> = ({ chunk, onClick }) => {
    const formattedDate = formatDateForDisplay(chunk.startDate)

    return (
        <>
            <p className="text-sm text-light pl-4 mt-6">{formattedDate}</p>
            {chunk.transactions.map((txn, i) => {
                return <Transaction key={`txn-${txn.transactionHash}`} txn={txn} onClick={onClick} />
            })}
        </>
    )
}
