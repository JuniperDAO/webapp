const IS_PRODUCTION = process.env.BRANCH_NAME === 'main'
const IS_DEV = process.env.NODE_ENV === 'development' // !['main', 'staging'].includes(process.env.BRANCH_NAME)

module.exports = {
    reactStrictMode: false,

    // Use the CDN in production, staging, and other GCP/run servers.
    // Note that "*.wfi.dev" behaves just as production
    assetPrefix: !IS_DEV ? `https://storage.googleapis.com/${process.env.BUCKET_NAME}/${process.env.SHORT_SHA}` : undefined,

    // what is this?
    images: {
        domains: ['storage.googleapis.com'], // Add the domain name here
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'storage.googleapis.com',
                port: '',
                pathname: '**',
            },
        ],
    },
    env: {
        // NEXT_PUBLIC...
    },
    async headers() {
        return [
            {
                // matching all API routes
                // https://blog.logrocket.com/using-cors-next-js-handle-cross-origin-requests/#prerequisites-learning-configure-cors-next-js
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Credentials', value: 'true' },
                    { key: 'Access-Control-Allow-Origin', value: '*' }, // replace this your actual origin
                    {
                        key: 'Access-Control-Allow-Methods',
                        value: 'GET,DELETE,PATCH,POST,PUT',
                    },
                    {
                        key: 'Access-Control-Allow-Headers',
                        value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: `default-src 'self' https://cdn.plaid.com/; script-src 'self' https://cdn.plaid.com/link/v2/stable/link-initialize.js; frame-src 'self' https://cdn.plaid.com/; connect-src 'self' https://production.plaid.com/;`,
                    },
                ],
            },
        ]
    },
}

// Injected content via Sentry wizard below
if (!IS_DEV) {
    const { withSentryConfig } = require('@sentry/nextjs')

    module.exports = withSentryConfig(
        module.exports,
        {
            // For all available options, see:
            // https://github.com/getsentry/sentry-webpack-plugin#options

            // Suppresses source map uploading logs during build
            silent: false,
            org: 'tungsten-financial-inc',
            project: IS_PRODUCTION ? 'juniper-main' : 'juniper-staging',
        },
        {
            // For all available options, see:
            // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

            // Upload a larger set of source maps for prettier stack traces (increases build time)
            widenClientFileUpload: true,

            // Transpiles SDK to be compatible with IE11 (increases bundle size)
            transpileClientSDK: true,

            // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
            tunnelRoute: '/monitoring',

            // Hides source maps from generated client bundles
            hideSourceMaps: true,

            // Automatically tree-shake Sentry logger statements to reduce bundle size
            disableLogger: true,

            // https://docs.sentry.io/api/auth/
            authToken: process.env.SENTRY_AUTH_TOKEN,
        }
    )
}
