import { IS_PRODUCTION } from '../constants'
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'

const config = new Configuration({
    basePath: IS_PRODUCTION ? PlaidEnvironments.production : PlaidEnvironments.development,
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': process.env.NEXT_PUBLIC_PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
        },
    },
})

export const getPlaidClient = function () {
    return new PlaidApi(config)
}
