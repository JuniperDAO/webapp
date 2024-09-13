'use client'
/* eslint-disable react-hooks/exhaustive-deps */
import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { FullScreenSpinner } from '@/components/Reusable/FullScreenSpinner'
import { JuniperUser } from './types'
import { usePrivy, useWallets, User } from '@privy-io/react-auth'
import { usePrivySmartAccount } from '@zerodev/privy'
import { createAndSaveSessionSigner } from '@/libs/zerodev'
import { analytics } from 'libs/evkv'
import { POST } from '@/libs/request'
import { log, redactKey } from '@/libs/util/log'
import { safeStringify, SMART_WALLET_VERSION } from '@/libs/constants'
import { Crisp } from 'crisp-sdk-web'
import * as Sentry from '@sentry/nextjs'
import { formatAddress } from '@/libs/util/formatAddress'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { TransactionsContext } from '../Transactions/TransactionsContext'

export type UserContextProps = {
    user?: JuniperUser
    setUser?: (user: JuniperUser) => void
    smartWalletProvider?: any
    smartWalletAddress?: string
    sessionKey: string
    logout: () => Promise<void>
    updateSessionSigner: () => Promise<void>
}

const defaultUserContextProps: UserContextProps = {
    user: null,
    setUser: () => {},
    smartWalletProvider: null,
    smartWalletAddress: null,
    sessionKey: null,
    logout: async () => {},
    updateSessionSigner: async () => {},
}

export const userContext = createContext<UserContextProps>(defaultUserContextProps)

const publicRoutes = ['/register', '/logout', '/connect', '/oauth/coinbase/callback', '/bridge/callback', '/support', '/error', '/constants', '/r']

function UserProvider({ children }) {
    const router = useRouter()
    const [user, setUser] = useState<JuniperUser | null>(null)
    const { cancelRefreshLoanInfo } = useContext(creditLineContext)
    const { cancelRefreshTransactions } = useContext(TransactionsContext)

    const [isLoadingAuth, setIsLoadingAuth] = useState(true)
    const [isRegistering, setIsRegistering] = useState(false)
    const [smartWalletAddress, setSmartWalletAddress] = useState<string | null>(null)
    const [smartWalletProvider, setSmartWalletProvider] = useState<any | null>(null)
    const [sessionKey, setSessionKey] = useState<string | null>(null)

    const {
        ready: privySmartAccountReady,
        zeroDevReady,
        getEthereumProvider,
        authenticated: isAuthenticated,
        user: privyUser,
        logout: privyLogout,
    } = usePrivySmartAccount()

    const clearAllLocalStorage = () => {
        ;[
            'juniper-user',
            'juniper-auth-token',
            'juniper-coinbase-oauth-security-nonce',
            'juniper-onboarding-status',
            'juniper-receive-address',
            'referrer',
        ].forEach((key) => {
            localStorage.removeItem(key)
        })
    }

    const logout = async () => {
        cancelRefreshLoanInfo()
        cancelRefreshTransactions()

        await privyLogout()
        await clearAllLocalStorage()
        window.location.href = '/signin'
    }

    const updateSessionSigner = async () => {
        const provider = await getEthereumProvider()
        setSessionKey(await createAndSaveSessionSigner(provider as any))
    }

    useEffect(() => {
        const isOnDashboardOrOnboarding = checkIsOnDashboardOrOnboarding(router.route)
        const isSigningIn = router.route.includes('signin')

        log('current conditions', {
            zeroDevReady,
            privySmartAccountReady,
            isAuthenticated,
            isOnDashboardOrOnboarding,
            isSigningIn,
        })

        if (!privySmartAccountReady || !router || !router.route) {
            return
        } else if (!isAuthenticated) {
            setUser(null)
            setIsLoadingAuth(false)
            // referral program
            if (!router.route.startsWith('/r/') && !router.route.startsWith('/signin')) {
                log('User is not authenticated, redirecting to signin')
                router.replace('/signin')
            }
            return
        } else if (isAuthenticated && zeroDevReady && !isRegistering) {
            const referrer = localStorage.getItem('referrer')
            if (referrer) {
                analytics.track('registerWithReferrer', { referrer })
            }

            setIsRegistering(true)

            const _ = async () => {
                const provider = await getEthereumProvider()
                const address = await provider.getAddress()
                setSmartWalletProvider(provider)
                setSmartWalletAddress(address)
                log(`have smart wallet address: ${smartWalletAddress}, provider ${typeof provider}`)

                const res = await POST('/api/register', { privyUser: privyUser, referredBy: referrer, smartWalletAddress: address })
                if (res.status === 200) {
                    const registered: JuniperUser = res.data?.user as JuniperUser
                    setUser(registered)

                    const thisSmartWallet = res.data?.user?.smartWallets?.find((wallet) => wallet.smartContractWalletAddress === address)

                    if (!thisSmartWallet || new Date(thisSmartWallet.sessionKeyUpdatedAt) < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
                        updateSessionSigner()
                    } else {
                        log(`Not updating session signer because last update was less than 24 hours ago (${thisSmartWallet.sessionKeyUpdatedAt})`)
                        setSessionKey(thisSmartWallet.sessionKey)
                    }

                    analytics.identify(registered.id, {
                        did: registered.did,
                        email: registered.email,
                        smartWalletAddress: address,
                    })

                    try {
                        // https://docs.sentry.io/platforms/javascript/enriching-events/identify-user/
                        // be careful with this. it can pick up the user session key, or other sensitive data
                        const scrubbedRegistered = { ...registered }
                        if (scrubbedRegistered.smartWallets) {
                            scrubbedRegistered.smartWallets = scrubbedRegistered.smartWallets.map((wallet) => {
                                const scrubbedWallet = { ...wallet, sessionKey: redactKey(wallet.sessionKey) }
                                return scrubbedWallet
                            })
                        }
                        Sentry.setUser(scrubbedRegistered)

                        Crisp.load()

                        if (registered.email) {
                            Crisp.user.setEmail(registered.email)
                        }

                        Crisp.session.setData({
                            eoaWalletAddress: `oeth:${registered.eoaWalletAddress}`,
                            smartWalletAddress: `oeth:${address}`,
                        })
                    } catch (ex) {
                        Sentry.captureException(ex)
                    }

                    if (!isOnDashboardOrOnboarding) {
                        await router.push('/dashboard')
                    }
                } else if (res.status === 401) {
                    await logout()
                } else {
                    console.error('Error registering user', res)
                    Sentry.captureException(new Error(`Error registering user: ${safeStringify(res)}`))
                    await logout()
                }

                setIsRegistering(false)
                setIsLoadingAuth(false)
            }

            _()
        }
    }, [privySmartAccountReady, isAuthenticated, zeroDevReady, router, router.route])

    if (isLoadingAuth) {
        return <FullScreenSpinner />
    }

    return (
        <userContext.Provider
            value={{
                user,
                setUser,
                logout,
                smartWalletProvider,
                smartWalletAddress,
                sessionKey,
                updateSessionSigner,
            }}>
            {children}
        </userContext.Provider>
    )
}

const checkIsOnDashboardOrOnboarding = (route: string) => {
    if (route.includes('dashboard')) return true

    for (let i = 0; i < publicRoutes.length; i++) {
        if (route.includes(publicRoutes[i])) return true
    }

    return false
}

export default UserProvider
