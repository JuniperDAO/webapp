import { Html, Head, Main, NextScript } from 'next/document'
import { analytics } from '@/libs/evkv'
import { useEffect } from 'react'

export default function Document() {
    useEffect(() => {
        analytics.page()
    }, [])

    return (
        <Html lang="en">
            <Head>
                <meta name="title" content="Juniper" />
                <meta name="description" content="Juniper: Spend Money From Your Crypto, Without Selling" />

                {/* https://stackoverflow.com/questions/10200312/what-is-the-minimum-width-and-height-of-facebook-open-graph-images */}
                <meta property="og:image" content="/favicon/og-image.png" />

                {/* https://developers.facebook.com/tools/debug/?q=https%3A%2F%2Fjuniper.wfi.dev%2Fdashboard */}
                <meta property="og:title" content="Juniper" />
                <meta property="og:site_name" content="Juniper" />
                <meta property="og:url" content="https://www.juniperfi.com" />
                <meta property="og:description" content="Juniper is the easiest way to spend money without selling your crypto." />
                <meta property="og:type" content="product" />

                {/* TUN-448, apple add to home screen tags */}
                <meta name="application-name" content="Juniper" />
                <meta name="apple-mobile-web-app-title" content="Juniper" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="mobile-web-app-capable" content="yes" />
                {/* https://medium.com/appscope/changing-the-ios-status-bar-of-your-progressive-web-app-9fc8fbe8e6ab */}
                <meta name="apple-mobile-web-app-status-bar-style" content="black" />

                <link rel="apple-touch-icon" sizes="180x180" href="/favicon/apple-touch-icon.png?r=1" />
                <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png" />
                <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png" />
                <link rel="manifest" href="/favicon/site.webmanifest" />
            </Head>
            <body>
                <Main />
                <NextScript />
                <div id="modal-root" />
            </body>
        </Html>
    )
}
