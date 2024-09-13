// pages/api/create_link_token.js
import { IS_PRODUCTION } from '@/libs/constants'
import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { getPlaidClient } from '@/libs/plaid/plaidConfig'

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const user = await userFromTokenMiddleware(req, res)
        if (!user) throw new Error(`No user found for ${req.headers.authorization}`)

        try {
            const client = getPlaidClient()
            const response = await client.linkTokenCreate({
                user: {
                    client_user_id: user.id,
                },
                client_name: 'Juniper by Tungsten Financial',
                products: [
                    Products.Auth,
                    // Products.Balance,
                    // Products.Transactions,
                    // Products.Identity,
                ],
                country_codes: [CountryCode.Us],
                language: 'en',
            })
            console.log('link token create', response.status, response.data)

            res.status(200).json(response.data)
        } catch (error) {
            console.error(error)
            res.status(500).json({ error: 'An error occurred when creating the link token.' })
        }
    } else {
        res.setHeader('Allow', ['POST'])
        res.status(405).end('Method Not Allowed')
    }
}
