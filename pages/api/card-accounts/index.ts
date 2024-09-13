import prisma from '@/libs/prisma'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { NextApiRequest, NextApiResponse } from 'next'
import { BRIDGE_XYZ_API_URL, safeStringify } from '@/libs/constants'
import { getOrCreateUserBridge } from '@/libs/bridge-xyz/api'
import { log } from '@/libs/util/log'
import axios from 'axios'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(404).json({ error: 'Not found' })
    }

    if (req.method === 'GET') {
        const accounts = await prisma.cardAccount.findMany({
            where: {
                ownerId: user.id,
                provider: {
                    not: 'bridge',
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        })

        const balances = new Map<string, number>()

        // deal with bridge
        const hasBridgeAccount = accounts.some((account) => account.provider === 'bridge')
        const bankNames = new Map<string, string>()
        const names = new Map<string, string>()
        const last4s = new Map<string, string>()
        const _updateBridgeAccount = async (account) => {
            await prisma.cardAccount.update({
                where: { id: account.id },
                data: {
                    bankName: account.bankName,
                    name: account.name,
                    last4: account.last4,
                },
            })
        }

        if (hasBridgeAccount && user.email) {
            let userBridge = await getOrCreateUserBridge(user.email, user.id)
            if (userBridge?.customerId) {
                // if we have a customer ID, they may have external accounts already connected. return them
                const response = await axios.get(`${BRIDGE_XYZ_API_URL}/v0/customers/${userBridge.customerId}/external_accounts`, {
                    headers: {
                        'Api-Key': process.env.BRIDGE_XYZ_API_KEY,
                    },
                })

                response.data?.data.map((externalAccount) => {
                    bankNames.set(externalAccount.id, externalAccount.bank_name)
                    names.set(externalAccount.id, externalAccount.account_name)
                    last4s.set(externalAccount.id, externalAccount.last_4)
                })
            }

            accounts
                .filter((account) => account.provider === 'bridge')
                .map((account) => {
                    account.bankName = bankNames.get(account.externalAccountId)
                    account.name = names.get(account.externalAccountId)
                    account.last4 = last4s.get(account.externalAccountId)

                    _updateBridgeAccount(account)
                })
        }

        // redact stuff before it goes to the client
        accounts.map((account) => {
            delete account.apiAccessToken
            delete account.apiRefreshToken
        })

        res.status(200).json({
            error: false,
            cardAccounts: accounts,
            balances: balances,
        })
    } else {
        res.status(400).json({
            error: 'Bad request',
        })
    }
}
