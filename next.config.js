const IS_PRODUCTION = process.env.BRANCH_NAME === 'main'
const IS_DEV = process.env.NODE_ENV === 'development' // !['main', 'staging'].includes(process.env.BRANCH_NAME)

module.exports = {
    reactStrictMode: false,

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
