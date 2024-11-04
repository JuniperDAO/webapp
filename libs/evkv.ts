import Analytics from 'analytics'
import googleAnalytics from '@analytics/google-analytics'
import fetch from 'cross-fetch'
import * as Sentry from '@sentry/nextjs'

import { IS_PRODUCTION } from './constants'

// {"traits": {"did": "did:privy:clntkbeer05mzmp0fbl7p4n2x", "email": "dave+icloud@artichokelabs.com", "wallet": {"address": "0xaec66887Af4B973C8B5EC50790B863C90cF4FD44", "chainType": "ethereum", "chainId": "eip155:1", "walletClient": "privy", "walletClientType": "privy", "connectorType": "embedded"}}}
type WalletTraits = {
    address: string
    chainType: string
    chainId: string
    walletClient: string
    walletClientType: string
    connectorType: string
}

type Traits = {
    did: string
    email: string
    wallet: WalletTraits
}

function InternalAnalytics(userConfig) {
    let currentTraits = {} as Traits

    function _send_to_server(payload) {
        try {
            payload = { ...payload }
            payload['app'] = userConfig['app']

            if (currentTraits && payload['type'] !== 'identify') {
                payload['properties'] = { ...payload['properties'] }
                if (!payload['properties']['did'] && currentTraits.did) {
                    payload['properties']['did'] = currentTraits.did
                }

                for (const k of ['address', 'chainType', 'chainId']) {
                    if (currentTraits?.wallet?.[k]) {
                        payload['properties'][k] = currentTraits.wallet[k]
                    }
                }
            }

            if (userConfig['debug']) {
                if (typeof window !== 'undefined') {
                    console.debug('internal-analytics-plugin', payload?.event || payload?.properties?.path, payload)
                    if (!payload['user_id'] && !payload['userId']) {
                        console.warn(`internal-analytics-plugin: no user_id or userId in payload`, payload)
                    }
                }
            }

            const res = fetch('https://evkv.juniperfi.com/event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            })
        } catch (ex) {
            Sentry.captureException(ex, payload)
        }
    }

    return {
        name: 'internal-analytics-plugin',
        initialize: ({ config }) => {},
        page: ({ payload }) => {
            _send_to_server(payload)
        },
        track: ({ payload }) => {
            _send_to_server(payload)
        },
        identify: ({ payload }) => {
            try {
                let currentTraits = payload['traits']
                if (typeof tracker !== 'undefined' && tracker) {
                    if (currentTraits?.wallet?.address) {
                        tracker.setUserID(currentTraits?.wallet?.address)
                    }
                }
            } catch (ex) {
                Sentry.captureException(ex)
            }

            // has its own exception handler
            _send_to_server(payload)
        },
        loaded: () => {
            return true
        },
    }
}

// somewhat interesting in that i've often used a server-generated 1st page view to associate the client-side ID with that on the server. probably possible here too since our / is served by Node
// analytics.storage.setItem('__anon_id', <your server generated anon ID here>);

/* Initialize analytics */
const app = IS_PRODUCTION ? 'juniper-main' : 'juniper-staging'
const debug = !IS_PRODUCTION

export const analytics = Analytics({
    app: app,
    debug: debug,
    plugins: [
        // InternalAnalytics({ app: app, debug: debug }),
        googleAnalytics({
            measurementIds: ['G-LDD8J4YW4V'],
        }),
    ],
})
