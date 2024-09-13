'use client'

import { ERC20PriceFeed, PriceAsset, PriceSubscriptionCallbackParams } from '@/libs/priceFeed/ERC20PriceFeed'
import { createContext, useEffect, useState } from 'react'
import { GET } from '@/libs/request'

export type AssetPricesProps = {
    wstethPriceUSD: number
    ethPriceUSD: number
    aavePriceUSD: number
    linkPriceUSD: number
    opPriceUSD: number
    wbtcPriceUSD: number
    rethPriceUSD: number
    isLoading: boolean
    lidoAPR: number
    getPriceByAssetName: (assetName: string) => number // Added prop
}

const defaultAssetPrices: AssetPricesProps = {
    wstethPriceUSD: 2400,
    ethPriceUSD: 1800,
    aavePriceUSD: 80,
    linkPriceUSD: 10,
    opPriceUSD: 2,
    wbtcPriceUSD: 35000,
    rethPriceUSD: 2300,
    isLoading: true,
    lidoAPR: 2.5,
    getPriceByAssetName: (assetName: string) => 1,
}

export const AssetPricesContext = createContext<AssetPricesProps>(defaultAssetPrices)

export const getLidoAPR = async (): Promise<number> => {
    try {
        const response = await GET<any>('/api/marketing/apr')
        return response.data.lido_staking_apy_ma
    } catch (error) {
        console.error('Error fetching APR:', error)
        return 0
    }
}

const _getPriceByAssetName = (prices, assetName: string) => {
    if (!assetName) {
        throw new Error(`Invalid asset: ${assetName}`)
    }

    if (['USDC', 'USDT', 'DAI', 'USDCN', 'USDC.E'].includes(assetName.toUpperCase())) {
        return 1
    }

    // XXX: if we do non-stable debt, this will be wrong
    if (assetName.indexOf('Debt') !== -1) {
        return 1
    }

    const normalizedAssetName = assetName === 'WETH' ? 'ETH' : assetName
    const price = prices[normalizedAssetName.toUpperCase()]
    if (!price) {
        throw new Error(`Price not found for asset: ${assetName}`)
    }

    return price
}

function AssetPricesProvider({ children }) {
    const [assetPrices, setAssetPrices] = useState<AssetPricesProps>(defaultAssetPrices)

    useEffect(() => {
        const assetPriceFeed = new ERC20PriceFeed([
            PriceAsset.ETH,
            PriceAsset.WSTETH,
            PriceAsset.AAVE,
            PriceAsset.LINK,
            PriceAsset.OP,
            PriceAsset.WBTC,
            PriceAsset.RETH,
        ])

        const updatePrices = (prices: PriceSubscriptionCallbackParams) => {
            setAssetPrices((prevProps) => ({
                ...prevProps,
                wstethPriceUSD: prices[PriceAsset.WSTETH] || defaultAssetPrices.wstethPriceUSD,
                ethPriceUSD: prices[PriceAsset.ETH] || defaultAssetPrices.ethPriceUSD,
                aavePriceUSD: prices[PriceAsset.AAVE] || defaultAssetPrices.aavePriceUSD,
                linkPriceUSD: prices[PriceAsset.LINK] || defaultAssetPrices.linkPriceUSD,
                opPriceUSD: prices[PriceAsset.OP] || defaultAssetPrices.opPriceUSD,
                wbtcPriceUSD: prices[PriceAsset.WBTC] || defaultAssetPrices.wbtcPriceUSD,
                rethPriceUSD: prices[PriceAsset.RETH] || defaultAssetPrices.rethPriceUSD,
                isLoading: false,
                getPriceByAssetName: (assetName) => _getPriceByAssetName(prices, assetName),
            }))
        }

        async function initSubscription() {
            const prices = await assetPriceFeed.fetchPrices()
            const lidoAPR = await getLidoAPR()

            updatePrices(prices)
            setAssetPrices((prevProps) => ({
                ...prevProps,
                lidoAPR: lidoAPR,
            }))

            await assetPriceFeed.subscribe(updatePrices)
        }

        initSubscription().then(null)

        // clean up the subscription
        return () => {
            assetPriceFeed.unsubscribe()
        }
    }, [])

    return <AssetPricesContext.Provider value={assetPrices}>{children}</AssetPricesContext.Provider>
}

export default AssetPricesProvider
