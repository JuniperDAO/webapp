import { add } from 'date-fns'
import { JuniperTransaction } from './types'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { AAVE_SUPPLIABLE_ERC20_ADDRESSES, OPTIMISM_AAVE_ERC20_REPAY_ADDRESSES, OPTIMISM_AAVE_ERC20_DEPOSIT_ADDRESSES } from '@/libs/constants'

export type GetTransforHistoryResponse = {
    transactions: JuniperTransaction[]
    nextPage?: string
}

export type TransfersClientConstructor = {
    address: string
}

// We get transfers from these addresses by default
const defaultAssetAddresses = [
    AaveV3Optimism.ASSETS.wstETH.UNDERLYING.toLowerCase(),
    ...Array.from(AAVE_SUPPLIABLE_ERC20_ADDRESSES.entries()).map(([symbol, address]) => {
        return address.toLowerCase()
    }),
    ...OPTIMISM_AAVE_ERC20_REPAY_ADDRESSES.map((address) => address.toLowerCase()),
]

export abstract class TransfersClient {
    protected address: string // the user's smart wallet address
    protected assetAddresses: string[]

    protected depositAddresses: string[] // the address where the user deposits wsteth to (e.g. aave)
    protected repayAddresses: string[] // the address where the user repays usdc to (e.g. aave)

    constructor({ address }: TransfersClientConstructor) {
        this.address = address.toLowerCase()
        this.assetAddresses = defaultAssetAddresses

        // when you deposit, aave transfers your wsteth
        // to their wsteth erc20 wrapper contract
        // need addresses for each
        this.depositAddresses = OPTIMISM_AAVE_ERC20_DEPOSIT_ADDRESSES.map((address) => address.toLowerCase())

        // when you repay, aave transfers your usdc
        // to their usdc erc20 contract
        this.repayAddresses = OPTIMISM_AAVE_ERC20_REPAY_ADDRESSES.map((address) => address.toLowerCase())
    }

    abstract getTransferHistory(page?: string): Promise<GetTransforHistoryResponse>
}
