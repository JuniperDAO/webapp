import { GetTransforHistoryResponse, TransfersClient, TransfersClientConstructor } from './TransfersClient'
import fetch from 'cross-fetch'
import { JuniperTransaction, JuniperTransactionType } from './types'
import {
    IS_PRODUCTION,
    AAVE_INTERNAL_ADDRESSES,
    ENTRYPOINT_ADDRESS,
    REFERRAL_BONUS_SENDER_ADDRESSES,
    TUNGSTEN_ACCOUNTS_RECEIVABLE,
    UNISWAP_USDCE_USDCN_POOL_ADDRESS,
    UNISWAP_WSTETH_WETH_POOL_ADDRESS,
    safeStringify,
} from '@/libs/constants'
import { log } from '@/libs/util/log'
import { redis } from '@/libs/redis'
import { ERC20PriceFeed, PriceAsset } from '@/libs/priceFeed/ERC20PriceFeed'

const ETHERSCAN_OPTIMISM_API_URL = 'https://api-optimistic.etherscan.io/api'

const OPTIMISM_ETHERSCAN_API_KEY = process.env.OPTIMISM_ETHERSCAN_API_KEY

/**
 * This class is used to fetch transactions from Alchemy's API
 *
 * And parse them into JuniperTransactions
 *
 * NOTE: remember to normalize addresses to lowercase
 */
export class EtherscanTransfersClient extends TransfersClient {
    constructor({ address }: TransfersClientConstructor) {
        super({ address })
    }

    async invalidateTransfersCache() {
        const url = this.getEtherscanUrl()
        const r = redis()
        r.del(url)
        // log(`Transfers cache (etherscan) INVALIDATE ${this.address}`)
    }

    async getAverageDailyBalance(trailingDays: number): Promise<number> {
        const today = new Date()
        const startDate = new Date(today.getTime() - trailingDays * 24 * 60 * 60 * 1000)
        let transactions: JuniperTransaction[] = []
        let nextPage: string | undefined = undefined
        do {
            const response = await this.getTransferHistory(nextPage)
            transactions = transactions.concat(response.transactions)
            nextPage = response.nextPage
        } while (nextPage)
        const filteredTransactions = transactions.filter((txn) => {
            const txnDate = new Date(txn.date)
            return txnDate >= startDate && txnDate <= today && (txn.from === this.address || txn.to === this.address)
        })
        filteredTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        log(`${this.address} has ${filteredTransactions.length} txns since ${startDate}`)
        const balanceMap = new Map<string, number>()
        filteredTransactions.forEach((txn) => {
            if (txn.type == JuniperTransactionType.Withdraw) {
                const balance = balanceMap.get(txn.currency) || 0
                balanceMap.set(txn.currency, balance - txn.amount)
            } else if (txn.type == JuniperTransactionType.Deposit) {
                const balance = balanceMap.get(txn.currency) || 0
                balanceMap.set(txn.currency, balance + txn.amount)
            }
        })

        const assetPriceFeed = new ERC20PriceFeed([
            PriceAsset.ETH,
            PriceAsset.WSTETH,
            PriceAsset.AAVE,
            PriceAsset.LINK,
            PriceAsset.OP,
            PriceAsset.WBTC,
            PriceAsset.RETH,
        ])
        const prices = await assetPriceFeed.fetchPrices()

        let totalUSDBalance = 0
        for (const [currency, balance] of balanceMap) {
            let symbol = currency.toUpperCase()
            if (symbol === 'WETH') {
                symbol = 'ETH'
            }
            if (!prices[symbol]) {
                throw new Error(`${this.address} Unknown currency ${currency}`)
            }
            const usdBalance = balance * prices[symbol]
            totalUSDBalance += usdBalance
        }
        totalUSDBalance = Math.max(totalUSDBalance, 0)

        log(`${this.address} final balance ${totalUSDBalance}`, balanceMap, prices)

        return totalUSDBalance
    }

    async getTransferHistory(page?: string): Promise<GetTransforHistoryResponse> {
        const { status, message, result } = await this.fetchTransactions(page)

        // https://tungsten-financial-inc.sentry.io/issues/5146652701/?project=4506068068794368&query=is%3Aunresolved&referrer=issue-stream&stream_index=0
        if (status === '0' && message === 'No transactions found') {
            return {
                transactions: [],
            }
        }

        if (status !== '1' || message !== 'OK') {
            throw new Error(`Failed to fetch transactions for ${this.address}: ${message} ${status} ${result}`)
        }

        const transactions = this.parseJuniperTxns(result)
        return {
            // nextPage: pageKey,
            transactions,
        }
    }

    private getEtherscanUrl(): string {
        const etherscanBaseUrl = ETHERSCAN_OPTIMISM_API_URL
        const module = 'account'
        const action = 'tokentx'
        const page = 1
        const offset = 100
        const startblock = 0
        const endblock = 99999999
        const sort = 'desc'
        const apiKey = OPTIMISM_ETHERSCAN_API_KEY

        return `${etherscanBaseUrl}?module=${module}&action=${action}&address=${this.address}&page=${page}&offset=${offset}&startblock=${startblock}&endblock=${endblock}&sort=${sort}&apikey=${apiKey}`
    }

    private fetchTransactions = async (pageKey?: string): Promise<OptimisticEtherscanTransferResponseJSON> => {
        const r = redis()
        const ttl = 300
        const url = this.getEtherscanUrl()

        const cachedResponse = IS_PRODUCTION ? await r.get(url) : null
        if (cachedResponse) {
            const cacheTTL = ttl // 300 seconds
            await r.expire(url, cacheTTL)
            // log(`Transfers cache HIT ${this.address}`)
            return JSON.parse(cachedResponse)
        } else {
            // log(`Transfers cache MISS ${this.address}, GET ${url}`)
            const response = await fetch(url)

            const json = (await response.json()) as OptimisticEtherscanTransferResponseJSON
            await r.setex(url, ttl, JSON.stringify(json))

            return json
        }
    }

    private parseJuniperTxns = (transfers: OptimisticEtherscanTransfer[]): JuniperTransaction[] => {
        let maybeTxns: (JuniperTransaction | null)[] = transfers.map(this.parseJuniperTxn)

        return maybeTxns.filter((txn) => !!txn)
    }

    private parseJuniperTxn = (transfer: OptimisticEtherscanTransfer): JuniperTransaction | null => {
        const txnType = this._getTxnType(transfer)

        if (!txnType) {
            return null
        }

        const tokenDecimal = parseInt(transfer.tokenDecimal)
        const amount = parseInt(transfer.value) / Math.pow(10, tokenDecimal)
        if (!amount) {
            return null
        }

        return {
            type: txnType,
            amount,
            from: transfer.from,
            to: transfer.to,
            date: new Date(parseInt(transfer.timeStamp) * 1000).toISOString(),
            transactionHash: transfer.hash,
            currency: transfer.tokenSymbol,
        }
    }

    private _getTxnType = (txn: OptimisticEtherscanTransfer): JuniperTransactionType | null => {
        // the order here matters a lot since these if statements are not mutually exclusive
        if (this._isReferralTxn(txn)) {
            // referral txns are technically account abstraction txns, so the txn.to is the ENTRYPOINT_ADDRESS, which we normally filter
            return JuniperTransactionType.ReferralBonus
        } else if (this._isInternalTxn(txn)) {
            return null // ignored
        } else if (this._isFeeTxn(txn)) {
            return JuniperTransactionType.Fee
        } else if (this._isRepayTxn(txn)) {
            return JuniperTransactionType.Repay
        } else if (this._isSpendTxn(txn)) {
            return JuniperTransactionType.Spend
        } else if (this._isDepositTxn(txn)) {
            return JuniperTransactionType.Deposit
        } else if (this._isWithdrawTxn(txn)) {
            return JuniperTransactionType.Withdraw
        }
    }

    private _isInternalTxn(txn: OptimisticEtherscanTransfer): boolean {
        if (!txn.tokenSymbol) {
            console.warn('No token symbol', txn)
            return true
        }

        if (txn.tokenSymbol.startsWith('aOpt')) {
            return true
        }

        const internalAddresses = [
            ENTRYPOINT_ADDRESS,
            UNISWAP_WSTETH_WETH_POOL_ADDRESS,
            UNISWAP_USDCE_USDCN_POOL_ADDRESS,

            // what is this? some wierd Uni pool I think
            '0x2e2d190ad4e0d7be9569baebd4d33298379b0502', // USDC <> USDC.e
            '0xd28f71e383e93c570d3edfe82ebbceb35ec6c412', // USDC <> DAI
            '0xb533c12fb4e7b53b5524eab9b47d93ff6c7a456f', // USDC <> OP
            '0x38d693ce1df5aadf7bc62595a37d667ad57922e5', // USDC
            '0xa73c628eaf6e283e26a7b1f8001cf186aa4c0e8e', // usdt
        ]
        if (internalAddresses.includes(txn.to.toLowerCase()) || internalAddresses.includes(txn.from.toLowerCase())) {
            return true
        }
    }

    private _isFeeTxn(txn: OptimisticEtherscanTransfer): boolean {
        return txn.to.toLowerCase() === TUNGSTEN_ACCOUNTS_RECEIVABLE
    }

    private _isReferralTxn(txn: OptimisticEtherscanTransfer): boolean {
        // do not show referral bonuses from the user's own address (e.g., you are logged in as corporate
        if (REFERRAL_BONUS_SENDER_ADDRESSES.includes(this.address)) {
            return false
        }

        return REFERRAL_BONUS_SENDER_ADDRESSES.includes(txn.from.toLowerCase())
    }

    // Spend transaction if it transfers USDC, and not to the repayment address
    private _isSpendTxn = (txn: OptimisticEtherscanTransfer): boolean => {
        // const didDepositToCoinbase = txn.to.toLowerCase() !== this.repayAddress
        const isStable = ['USDC.e', 'USDC.n', 'USDC'].includes(txn.tokenSymbol)

        return isStable && txn.to !== this.address
    }

    private _isWithdrawTxn = (txn: OptimisticEtherscanTransfer): boolean => {
        return txn.from === this.address
    }

    private _isDepositTxn = (txn: OptimisticEtherscanTransfer): boolean => {
        if (AAVE_INTERNAL_ADDRESSES.includes(txn.to.toLowerCase())) {
            return true
        }

        // return txn.to === this.address
    }

    private _isRepayTxn = (txn: OptimisticEtherscanTransfer): boolean => {
        if (txn.tokenSymbol.indexOf('Debt') !== -1 && txn.to === '0x0000000000000000000000000000000000000000') {
            return true
        }
    }
}

type OptimisticEtherscanTransferResponseJSON = {
    status: string
    message: string
    result: OptimisticEtherscanTransfer[]
}

type OptimisticEtherscanTransfer = {
    blockNumber: string
    timeStamp: string
    hash: string
    nonce: string
    blockHash: string
    from: string
    contractAddress: string
    to: string
    value: string
    tokenName: string
    tokenSymbol: string
    tokenDecimal: string
    transactionIndex: string
    gas: string
    gasPrice: string
    gasUsed: string
    cumulativeGasUsed: string
    input: string
    confirmations: string
}
