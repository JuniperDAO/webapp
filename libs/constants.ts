// you should expect from your env...
// NEXT_PUBLIC_BRANCH_NAME - GCP prod/staging builds set this to 'main', 'staging'; in dev, this may be undefined
// NEXT_PUBLIC_SHORT_SHA - GCP prod/staging builds set this. in dev, this is done in package.json before running the local dev server
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { BigNumber } from 'ethers'

export const IS_PRODUCTION = process.env.NEXT_PUBLIC_BRANCH_NAME === 'main' && process.env.NODE_ENV === 'production' ? true : false

// this is gonna be very fun when there are migrations required
export const SMART_WALLET_VERSION = 3

// in lieu of permissions, we're just relying on the keys expiriing
export const SESSION_KEY_EXPIRATION_S = 30 * 24 * 3600

// how long to wait for a transaction to be considered failed
export const INTENT_EXPIRATION_S = 6 * 3600

export const ENTRYPOINT_ADDRESS = '0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789'

export const AAVE_SUPPLIABLE_ERC20_SYMBOLS = ['WETH', 'OP', 'WBTC', 'wstETH', 'AAVE', 'LINK', 'rETH']
export const AAVE_SUPPORTED_STABLES = ['USDC', 'USDCn', 'USDT', 'DAI']

// https://search.onaave.com/?q=op%20Beth
export const AAVE_SUPPLIABLE_ERC20_ADDRESSES = new Map<string, string>()
export const AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE = new Map<string, string>()

export const OPTIMISM_AAVE_ERC20_DEPOSIT_ADDRESSES = []
export const OPTIMISM_AAVE_ERC20_REPAY_ADDRESSES = []
export const AAVE_INTERNAL_ADDRESSES = []

Object.entries(AaveV3Optimism.ASSETS).map((x) => {
    if (x) {
        const [symbol, info] = x

        if (info.A_TOKEN && info.V_TOKEN && info.S_TOKEN) {
            AAVE_INTERNAL_ADDRESSES.push(info.A_TOKEN.toLowerCase())
            AAVE_INTERNAL_ADDRESSES.push(info.V_TOKEN.toLowerCase())
            AAVE_INTERNAL_ADDRESSES.push(info.S_TOKEN.toLowerCase())
        } else {
            console.error(`AAVE asset ${symbol} is missing an address: ${JSON.stringify(info)}`)
        }

        if (AAVE_SUPPLIABLE_ERC20_SYMBOLS.indexOf(symbol) !== -1) {
            AAVE_SUPPLIABLE_ERC20_ADDRESSES.set(symbol, info.UNDERLYING.toLowerCase())
            AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE.set(info.UNDERLYING.toLowerCase(), symbol)

            OPTIMISM_AAVE_ERC20_DEPOSIT_ADDRESSES.push(info.A_TOKEN.toLowerCase())
        }
        if (AAVE_SUPPORTED_STABLES.indexOf(symbol) !== -1) {
            OPTIMISM_AAVE_ERC20_REPAY_ADDRESSES.push(info.A_TOKEN.toLowerCase())
        }
    }
})

// uniswap pools/etc
export const UNISWAP_WSTETH_WETH_POOL_ADDRESS = '0x04f6c85a1b00f6d9b75f91fd23835974cc07e65c'
export const UNISWAP_USDCE_USDCN_POOL_ADDRESS = '0x2ab22ac86b25bd448a4d9dc041bd2384655299c4'

export const TUNGSTEN_ACCOUNTS_RECEIVABLE = '0x56483010f4dd79e01b20cb4de22e9a0baa0baade'

export const RECOMMENDED_LOAN_LTV = 45

export const MIN_SEND_THRESHOLD_USD = IS_PRODUCTION ? 5 : 1
export const MIN_RELOAD_THRESHOLD_USD = IS_PRODUCTION ? 25 : 5

// expressed as % of Aave's pool max LTV, e.g. 70
// if you set this to 100% of Aave LTV, all borrows will fail
// if you set this to 99% of Aave LTV, maxing out a small line will fail :)
export const MAX_UTILIZATION_PERCENT_OF_LTV = 97

// how long to wait for borrowUSD
export const AAVE_BORROW_TIMEOUT_MS = 10 * 60 * 1000

// when quoting repay, how much slippage/dust to leave behind
export const REPAY_UNISWAP_SLIPPAGE = 1.01

export const ONE_DOLLAR = BigNumber.from(10).pow(18)

// frontends are pretty racy
export const NEW_USER_CREATION_LOCK_DURATION_MS = 30 * 1000

// maximum time we want to allow a refresh coinbase token operation to hold its user lock
export const COINBASE_REFRESH_TOKEN_LOCK_DURATION_MS = 3 * 60 * 1000

// maximum time to wait for Coinbase's OAuth window to load
export const CHILD_WINDOW_TIMEOUT_MS = 5 * 1000

// which bridge.xyz env to hit
export const BRIDGE_XYZ_API_URL = process.env.BRIDGE_XYZ_API_KEY?.includes('live') ? 'https://api.bridge.xyz' : 'https://api.sandbox.bridge.xyz'

// plaid, whee
export const PLAID_CLIENT_ID = process.env.NEXT_PUBLIC_PLAID_CLIENT_ID

// rake, by card provider
// would like this to only apply to borrowed funds, but that's not how it works
export const DEFAULT_RAKE = 0.04 // 4%

// override rake by by CardProvider here if you'd like
export const RAKE_BY_PROVIDER = {
    referral: 0,
}

// minimum rake to bother with sending to the user, USD
export const MIN_RAKE_USD = 0.5

export const USDC_PRECISION_FIXED = 6
export const ETH_DISPLAY_PRECISION_FIXED = 4
export const ETH_PRECISION_FIXED = 18

export const ETH_DEPOSIT_POLL_INTERVAL = 5000
export const ETH_MINIMUM_DEPOSIT_USD = 5

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

export const NEXT_PUBLIC_CRISP_WEBSITE_ID = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID

export function staticURL(path) {
    const short_sha = process.env.NEXT_PUBLIC_SHORT_SHA
    let bucket_name = process.env.NEXT_PUBLIC_BRANCH_NAME

    if (!path.startsWith('/')) {
        path = '/' + path
    }
    if (!bucket_name || !short_sha) {
        throw new Error(`config error: bucket_name: ${bucket_name} short_sha: ${short_sha}`)
    }

    if (bucket_name.includes('/')) {
        bucket_name = bucket_name.split('/')[0]
    }

    return 'https://storage.googleapis.com/juniper-' + bucket_name + '/' + short_sha + path
}

export const referralURL = (code) => {
    return `https://app.juniperfi.com/r/${code}`
}

export const OFAC_ADDRESSES = require('./ofac.json')

export const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

export const GCP_PROJECT_ID = 'tungstenfi'
export const GCP_LOCATION = 'us-central1'
export const DEFERRED_EXECUTION_SECRET = process.env.DEFERRED_EXECUTION_SECRET
export const DEFERRED_EXECUTION_BASE_URI = process.env.DEFERRED_EXECUTION_BASE_URI || 'https://app.juniperfi.com'
export const DEFERRED_EXECUTION_WORKFLOW_NAME = `httpPostRetry-${process.env.NEXT_PUBLIC_BRANCH_NAME?.split('/')[0]}`

export const BICONOMY_BUNDLER_URL = 'https://bundler.biconomy.io/api/v2/10/dewj2189.wh1289hU-7E49-45ic-af80-IY8aDy7P5'

export const REFERRAL_BONUS_PAYER_USER_ID = process.env.REFERRAL_BONUS_PAYER_USER_ID
export const REFERRAL_WORKFLOW_NAME = `iterateReferrals-${process.env.NEXT_PUBLIC_BRANCH_NAME?.split('/')[0]}`
export const REFERRAL_BONUS_SENDER_ADDRESSES = ['0x1302092841e169f0faa6edfcff35fd8793b7e0e1']

export const MAX_REFERRALS_PER_USER = 5
export const MAX_REFERRALS_PER_DAY = 3
export const MIN_DAILY_BALANCE_USD = 5
export const DAILY_BALANCE_LOOKBACK_DAYS = 14
export const DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS = DAILY_BALANCE_LOOKBACK_DAYS * 3

export function safeStringify(obj) {
    try {
        return JSON.stringify(obj)
    } catch (e) {
        return obj.toString()
    }
}

export function externalTestEmailAddress(email: string): string {
    if (!IS_PRODUCTION) {
        const [username, domain] = email.split('@')
        const randomSixDigitInteger = Math.floor(Math.random() * 900000) + 100000
        return `${username}+test${randomSixDigitInteger}@${domain}`
    }
    return email
}
