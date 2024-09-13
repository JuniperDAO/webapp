import { GET } from '@/libs/request'

import { GetTransforHistoryResponse } from '@/libs/transactionHistory/TransfersClient'
import { JuniperTransaction } from '@/libs/transactionHistory/types'

export type FetchTxnArgs = {
    page?: string
}

export type FetchTxnArgsPaginated = FetchTxnArgs & {
    callback: (txns: JuniperTransaction[]) => void | Promise<void>
}

export const fetchTransactionsPage = async ({ smartWalletAddress, page }): Promise<GetTransforHistoryResponse> => {
    const pageParam = page ? `&page=${page}` : ''

    // TODO - strong types
    const response = await GET<any>(`/api/wallet/transactions?smartWalletAddress=${smartWalletAddress}${pageParam}`)

    if (response.status !== 200) {
        throw new Error('Failed to fetch transactions', response.data)
    }

    return response.data
}

export const paginateThroughTransactions = async ({ smartWalletAddress, page: startPage, callback }) => {
    let page = startPage
    let keepGoing = true

    while (keepGoing) {
        const { transactions, nextPage } = await fetchTransactionsPage({ smartWalletAddress, page })

        await callback(transactions)

        if (!nextPage) {
            keepGoing = false
        } else {
            page = nextPage
        }
    }
}
