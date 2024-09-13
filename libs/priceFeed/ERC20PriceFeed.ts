import { BigNumber, Contract } from 'ethers'
import { aaveLendingPoolAddressProviderABI } from './AaveLendingPoolAddressProviderABI'
import { aavePriceOracleGetterABI } from './AavePriceOracleGetterABI'
import { getReadProvider } from '../getReadProvider'
import { Network } from '../network/types'
import { log } from '../util/log'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

const ONE_MINUTE = 60000

export enum PriceAsset {
    WSTETH = 'WSTETH',
    ETH = 'ETH',
    AAVE = 'AAVE',
    LINK = 'LINK',
    OP = 'OP',
    WBTC = 'WBTC',
    RETH = 'RETH',
}

export type PriceSubscriptionCallbackParams = {
    [key in PriceAsset]?: number
}

export type PriceSubscriptionCallback = (params: PriceSubscriptionCallbackParams) => void | Promise<void>

export class ERC20PriceFeed {
    private assets: PriceAsset[]
    private assetAddresses: string[]
    private refreshInterval: number
    private addressProviderContract: Contract

    private subscriptionInterval: NodeJS.Timeout | null = null
    private priceOracleContract: Contract | null = null

    constructor(assets: PriceAsset[], refreshInterval: number = ONE_MINUTE * 2) {
        this.assets = assets
        this.assetAddresses = assets.map(assetToAddress)
        this.refreshInterval = refreshInterval

        this.addressProviderContract = new Contract(
            AaveV3Optimism.POOL_ADDRESSES_PROVIDER,
            aaveLendingPoolAddressProviderABI,
            getReadProvider(Network.optimism)
        )
    }

    public subscribe = async (callback: PriceSubscriptionCallback) => {
        await this.refreshPriceOracleContract()

        this.subscriptionInterval = setInterval(async () => {
            const prices = await this.fetchPrices()

            callback(prices)
        }, this.refreshInterval)
    }

    public unsubscribe = () => {
        if (this.subscriptionInterval) {
            clearInterval(this.subscriptionInterval)
        }
    }

    public fetchPrices = async (): Promise<PriceSubscriptionCallbackParams> => {
        if (!this.priceOracleContract) {
            await this.refreshPriceOracleContract()
        }

        // console.log(`fetchPrices: ${this.assetAddresses}`)
        const prices = await this.priceOracleContract.getAssetsPrices(this.assetAddresses)
        // console.log(`fetchPrices: ${prices}`)

        const params: PriceSubscriptionCallbackParams = {}

        this.assets.forEach((asset, index) => {
            params[asset] = this.baseToUSD(prices[index])
        })

        return params
    }

    private refreshPriceOracleContract = async () => {
        const priceOracleAddress = await this.addressProviderContract.getPriceOracle()
        log(`Price oracle address: ${priceOracleAddress}`)

        this.priceOracleContract = new Contract(priceOracleAddress, aavePriceOracleGetterABI, getReadProvider(Network.optimism))
    }

    // we return the two digit floating point precision
    // of the USD value, e.g. $12.35
    private baseToUSD(base: BigNumber): number {
        const cents = base.div(1e6)
        const dollars = cents.toNumber() / 100
        const dollarsFixed = dollars.toFixed(2)

        return parseFloat(dollarsFixed)
    }
}

const assetToAddress = (asset: PriceAsset): string => {
    switch (asset) {
        case PriceAsset.ETH:
            return AaveV3Optimism.ASSETS.WETH.UNDERLYING
        case PriceAsset.WSTETH:
            return AaveV3Optimism.ASSETS.wstETH.UNDERLYING
        case PriceAsset.AAVE:
            return AaveV3Optimism.ASSETS.AAVE.UNDERLYING
        case PriceAsset.LINK:
            return AaveV3Optimism.ASSETS.LINK.UNDERLYING
        case PriceAsset.OP:
            return AaveV3Optimism.ASSETS.OP.UNDERLYING
        case PriceAsset.WBTC:
            return AaveV3Optimism.ASSETS.WBTC.UNDERLYING
        case PriceAsset.RETH:
            return AaveV3Optimism.ASSETS.rETH.UNDERLYING

        default:
            throw new Error(`Unknown asset: ${asset}`)
    }
}
