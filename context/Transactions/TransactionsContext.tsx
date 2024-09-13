'use client'

import { JuniperTransaction } from '@/libs/transactionHistory/types'
import { createContext, useContext, useEffect, useState } from 'react'
import { TransactionChunk, TransactionChunker, TransactionGroupBy } from './TransactionChunker'
import { userContext } from '../user/userContext'
import { fetchTransactionsPage, paginateThroughTransactions } from './transactionsFetcher'
import { useRouter } from 'next/router'

export type TransactionsProps = {
    rawTxns: JuniperTransaction[] // transactions without spend appended
    isLoadingInitial: boolean
    isPaginating: boolean
    txnsByDay: TransactionChunk[]
    txnsByMonth: TransactionChunk[]
    cancelRefreshTransactions: () => void
}

const defaultTransactionProps: TransactionsProps = {
    rawTxns: [],
    isLoadingInitial: true,
    isPaginating: true,
    txnsByDay: [],
    txnsByMonth: [],
    cancelRefreshTransactions: () => {},
}

const TRANSACTIONS_REFRESH_INTERVAL_S = 10

export const TransactionsContext = createContext<TransactionsProps>(defaultTransactionProps)

function TransactionsProvider({ children }) {
    const [transactionProps, setTransactionProps] = useState<TransactionsProps>(defaultTransactionProps)
    const [timer, setTimer] = useState(null)

    const { smartWalletAddress } = useContext(userContext)

    const handleNewTransactions = (newTransactions: JuniperTransaction[]) => {
        setTransactionProps((oldProps: TransactionsProps) => {
            const newRawTxns = [...newTransactions, ...oldProps.rawTxns]
            const chunker = new TransactionChunker(newTransactions)
            const newTxnsByDay = chunker.chunk(TransactionGroupBy.Date)
            const newTxnsByMonth = chunker.chunk(TransactionGroupBy.Month)

            return {
                ...oldProps,
                rawTxns: newRawTxns,
                txnsByDay: newTxnsByDay,
                txnsByMonth: newTxnsByMonth,
                isLoadingInitial: false,
            }
        })
    }

    // we first fetch the initial transactions page, and then
    // paginate through the rest of the transactions if needed
    const fetchInitialAndMaybePaginate = async (address: string) => {
        try {
            const { transactions, nextPage } = await fetchTransactionsPage({ smartWalletAddress, page: 0 })

            handleNewTransactions(transactions)

            if (nextPage) {
                await paginateThroughTransactions({
                    smartWalletAddress,
                    page: nextPage,
                    callback: handleNewTransactions,
                })
            }

            // mark pagination as complete
            setTransactionProps((oldProps: TransactionsProps) => {
                return {
                    ...oldProps,
                    isPaginating: false,
                }
            })
        } catch (e) {
            setTransactionProps((oldProps: TransactionsProps) => {
                return {
                    ...oldProps,
                    isLoadingInitial: false,
                    isPaginating: false,
                }
            })

            throw e
        }
    }

    useEffect(() => {
        if (!smartWalletAddress) return

        if (!timer) {
            setTimer(
                setInterval(async () => {
                    await fetchInitialAndMaybePaginate(smartWalletAddress)
                }, TRANSACTIONS_REFRESH_INTERVAL_S * 1000)
            )

            setTransactionProps((oldProps: TransactionsProps) => {
                return {
                    ...oldProps,
                    cancelRefreshTransactions: () => {
                        clearInterval(timer)
                        setTimer(null)
                    },
                }
            })
        }
    }, [smartWalletAddress])

    return <TransactionsContext.Provider value={transactionProps}>{children}</TransactionsContext.Provider>
}

export default TransactionsProvider
