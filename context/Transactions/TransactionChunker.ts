import { JuniperTransaction, JuniperTransactionType } from '@/libs/transactionHistory/types'
import { getLocalDay, getLocalMonth, getLocalWeek } from '@/libs/util/time'

export enum TransactionGroupBy {
    Date,
    Month,
    Week,
}

export type TransactionChunk = {
    startDate: string
    chunkLength: TransactionGroupBy
    transactions: JuniperTransaction[]
    totalSpend: number
}

/**
 * Class handles taking a list of transactions and chunking them into
 * groups by local date. This is used to display transactions in the UI.
 *
 * Note: we also append "Spend" transactions for each withdrawal
 */
export class TransactionChunker {
    allTxns: JuniperTransaction[]

    constructor(txns: JuniperTransaction[]) {
        this.allTxns = txns
    }

    chunk(chunkLength: TransactionGroupBy): TransactionChunk[] {
        const chunkArrays = this.getChunkArrays(this.allTxns, chunkLength)

        const chunks: TransactionChunk[] = chunkArrays.map((txns) => this.arrayToChunk(txns, chunkLength))

        return chunks
    }

    arrayToChunk(transactions: JuniperTransaction[], chunkLength: TransactionGroupBy): TransactionChunk {
        if (!transactions.length) throw new Error('Cannot create chunk from empty array')

        const totalSpend = transactions.reduce((acc, curr) => {
            if (curr.type === JuniperTransactionType.Spend && !curr?.transactionHash?.startsWith('intent')) {
                return acc + curr.amount
            }
            return acc
        }, 0)

        const txnsLength = transactions.length

        return {
            startDate: transactions[txnsLength - 1].date,
            chunkLength,
            transactions,
            totalSpend,
        }
    }

    oneMinuteBefore(dateStr: string): Date {
        const date = new Date(dateStr)
        return new Date(date.getTime() - 60 * 1000)
    }

    /**
     * Returns a list of chunks, each chunk containing a list of transactions
     * that occurred within the chunk's date range.
     */
    getChunkArrays(transactions: JuniperTransaction[], group: TransactionGroupBy): JuniperTransaction[][] {
        switch (group) {
            case TransactionGroupBy.Date:
                return this.groupByDate(transactions)
            case TransactionGroupBy.Month:
                return this.groupByMonth(transactions)
            case TransactionGroupBy.Week:
                return this.groupByWeek(transactions)
            default:
                throw new Error('Invalid group type')
        }
    }

    groupByDate(transactions: JuniperTransaction[]): JuniperTransaction[][] {
        const grouped: Record<string, JuniperTransaction[]> = {}
        transactions.forEach((transaction) => {
            const dateKey = getLocalDay(new Date(transaction.date))
            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(transaction)
        })
        return Object.values(grouped)
    }

    groupByMonth(transactions: JuniperTransaction[]): JuniperTransaction[][] {
        const grouped: Record<string, JuniperTransaction[]> = {}
        transactions.forEach((transaction) => {
            const dateKey = getLocalMonth(new Date(transaction.date))
            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(transaction)
        })
        return Object.values(grouped)
    }

    groupByWeek(transactions: JuniperTransaction[]): JuniperTransaction[][] {
        const grouped: Record<string, JuniperTransaction[]> = {}
        transactions.forEach((transaction) => {
            const year = new Date(transaction.date).getFullYear()
            const weekNumber = getLocalWeek(new Date(transaction.date))
            const dateKey = `${year}-W${weekNumber}`
            if (!grouped[dateKey]) grouped[dateKey] = []
            grouped[dateKey].push(transaction)
        })
        return Object.values(grouped)
    }
}
