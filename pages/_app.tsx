import type { AppProps } from 'next/app'
import Head from 'next/head'
import '@/styles/global.css'
import { inter } from '@/libs/font'
import UserProvider from '@/context/user/userContext'
import { usePullToRefresh } from 'use-pull-to-refresh'
import { Toaster } from 'sonner'
import { Loading } from '@/public/icons/StatusIcons'
import CreditLineProvider from '@/context/CreditLine/creditLineContext'
import AssetPricesProvider from '@/context/AssetPrices/AssetPricesContext'
import TransactionsProvider from '@/context/Transactions/TransactionsContext'
import CardAccountProvider from '@/context/CardAccounts/CardAccounts'
import { AuthProvider } from '@/context/Auth/AuthProvider'
import { ZeroDevProvider } from '@zerodev/privy'
import { AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/router'
import useFoucFix from '@/libs/use-fouc-fix'
import { toastStyles } from '@/libs/toastStyles'

import { useEffect } from 'react'
import { analytics } from 'libs/evkv'
import { Crisp } from 'crisp-sdk-web'
import { NEXT_PUBLIC_CRISP_WEBSITE_ID } from '@/libs/constants'

import type { NextWebVitalsMetric } from 'next/app'

const opId = process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_OPTIMISM

const MAXIMUM_PULL_LENGTH = 240
const REFRESH_THRESHOLD = 180

// "all your modules must run server and client" has weaknesses
// https://github.com/foliojs/brotli.js/issues/20
if (typeof window !== 'undefined') {
    // @ts-ignore
    if ((typeof window?.Browser as any) === 'undefined') {
        console.log('Browser not defined, setting it to window')
        // @ts-ignore
        window.Browser = {
            T: (...x) => {
                console.log('window.Browser()', x)
            },
        }
    }
}

export default function App({ Component, pageProps }: AppProps) {
    const { isReady, reload, events, asPath } = useRouter()

    useFoucFix()

    useEffect(() => {
        Crisp.configure(NEXT_PUBLIC_CRISP_WEBSITE_ID, { autoload: false })

        // When location changes in app send page view
        const handleRouteChange = (url) => {
            analytics.page()
        }
        events.on('routeChangeComplete', handleRouteChange)
        return () => {
            events.off('routeChangeComplete', handleRouteChange)
        }
    }, [events])

    const { isRefreshing, pullPosition } = usePullToRefresh({
        // you can choose what behavior for `onRefresh`, could be calling an API to load more data, or refresh whole page.
        onRefresh: reload,
        maximumPullLength: MAXIMUM_PULL_LENGTH,
        refreshThreshold: REFRESH_THRESHOLD,
        isDisabled: !isReady,
    })

    return (
        <>
            <Head>
                <meta name="viewport" content="initial-scale=1, viewport-fit=cover, width=device-width"></meta>
                <meta name="apple-mobile-web-app-capable" content="yes"></meta>
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"></meta>
            </Head>
            <main className={inter.className}>
                <div
                    style={{
                        top: (isRefreshing ? REFRESH_THRESHOLD : pullPosition) / 3,
                        opacity: isRefreshing || pullPosition > 0 ? 1 : 0,
                    }}
                    className="bg-base-100 fixed inset-x-1/2 z-30 h-8 w-8 -translate-x-1/2 rounded-full p-2">
                    <div
                        className={`h-full w-full ${isRefreshing ? 'animate-spin' : ''}`}
                        style={!isRefreshing ? { transform: `rotate(${pullPosition}deg)` } : {}}>
                        <Loading />
                    </div>
                </div>

                <ZeroDevProvider projectId={opId}>
                    <AuthProvider>
                        <UserProvider>
                            <CreditLineProvider>
                                <TransactionsProvider>
                                    <CardAccountProvider>
                                        <AssetPricesProvider>
                                            <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo(0, 0)}>
                                                <Component key={asPath} {...pageProps} />
                                            </AnimatePresence>
                                            <Toaster position="top-center" toastOptions={toastStyles} />
                                        </AssetPricesProvider>
                                    </CardAccountProvider>
                                </TransactionsProvider>
                            </CreditLineProvider>
                        </UserProvider>
                    </AuthProvider>
                </ZeroDevProvider>
            </main>
        </>
    )
}

export function reportWebVitals(metric: NextWebVitalsMetric) {
    // analytics.track('web-vitals', metric=metric)
}
