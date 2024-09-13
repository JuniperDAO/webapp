'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { CardAccount } from '@prisma/client'
import { GET, PUT } from '@/libs/request'
import { userContext } from '../user/userContext'
import { staticURL } from '@/libs/constants'
import { useRouter } from 'next/router'
import { CardProvider } from '@prisma/client'

export const getCardAccountDisplayInfo = (cardAccount: CardAccount) => {
    // console.log('cardAccount', cardAccount)
    if (cardAccount.provider === 'coinbase') {
        return {
            name: 'Coinbase',
            image: staticURL('/public/images/coinbase-card.png'),
            address: cardAccount.address,
            isFiat: false,
        }
    } else if (cardAccount.provider === 'bridge') {
        let name = cardAccount.bankName || 'Bridge Card'
        if (cardAccount.last4) {
            name += ' - ' + cardAccount.last4
        }
        return {
            name: name,
            image: staticURL('/public/images/bridge-card.png'),
            address: cardAccount.address,
            isFiat: true,
        }
    } else if (cardAccount.provider === 'wallet') {
        return {
            name: cardAccount.name,
            image: staticURL('/public/images/wallet-card.png'),
            address: cardAccount.address,
            isFiat: false,
        }
    } else {
        return {
            name: cardAccount.provider.charAt(0).toUpperCase() + cardAccount.provider.slice(1),
            image: staticURL('/public/images/generic-card.png'),
            address: cardAccount.address,
            isFiat: false,
        }
    }
}

export function getExchangeDisplayName(provider: CardProvider | string): string {
    if (typeof provider === 'string') {
        provider = CardProvider[provider as keyof typeof CardProvider]
    }

    switch (provider) {
        case CardProvider.coinbase:
            return 'Coinbase'
        case CardProvider.binance:
            return 'Binance'
        case CardProvider.crypto_dot_com:
            return 'Crypto.com'
        case CardProvider.bybit:
            return 'Bybit'
        case CardProvider.okx:
            return 'OKX'
        case CardProvider.gate_io:
            return 'Gate'
        case CardProvider.kucoin:
            return 'KuCoin'
        case CardProvider.kraken:
            return 'Kraken'
        case CardProvider.other_exchange:
            return 'Other'
        default:
            return null
    }
}

export function getExchanges() {
    let exchanges = Object.values(CardProvider).map((provider) => ({
        value: provider,
        displayName: getExchangeDisplayName(provider),
    }))

    return exchanges.filter((exchange) => exchange.displayName !== null)
}

export type CardAccountProps = {
    cardAccounts: CardAccount[]
    balances: Map<string, number>
    isLoading: boolean
    refreshCardAccounts: () => Promise<void>
    addressToCardAccountMap: Map<string, CardAccount>
}

const defaultCardAccountProps: CardAccountProps = {
    cardAccounts: [],
    balances: new Map<string, number>(),
    isLoading: true,
    refreshCardAccounts: async () => {},
    addressToCardAccountMap: new Map<string, CardAccount>(),
}

export const CardAccountContext = createContext<CardAccountProps>(defaultCardAccountProps)

function CardAccountProvider({ children }) {
    const router = useRouter()
    const { smartWalletAddress } = useContext(userContext)
    const [cardAccountProps, setCardAccountProps] = useState<CardAccountProps>(defaultCardAccountProps)

    const refreshCardAccounts = async () => {
        // check for logged in state, we also run on signed out
        if (smartWalletAddress) {
            const res = await GET<any>('/api/card-accounts')

            if (res?.data.cardAccounts) {
                // https://tungsten-financial-inc.sentry.io/issues/5027328365/?project=4506068068794368&query=is%3Aunresolved&referrer=issue-stream&stream_index=12
                const a2cMap = new Map<string, CardAccount>()
                res.data.cardAccounts.forEach((account: CardAccount) => {
                    // old school coinbase
                    if (account.address) {
                        a2cMap.set(account.address.toLowerCase(), account)
                    }
                })

                setCardAccountProps((oldProps: CardAccountProps) => ({
                    ...oldProps,
                    cardAccounts: res.data.cardAccounts,
                    balances: new Map<string, number>(Object.entries(res.data.balances)),
                    isLoading: false,
                    addressToCardAccountMap: a2cMap,
                }))
            } else {
                console.error('Error fetching card accounts', res)
            }
        }
    }

    useEffect(() => {
        refreshCardAccounts().then(null)
    }, [])

    const contextValue = {
        ...cardAccountProps,
        refreshCardAccounts,
    }

    return <CardAccountContext.Provider value={contextValue}>{children}</CardAccountContext.Provider>
}

export default CardAccountProvider
