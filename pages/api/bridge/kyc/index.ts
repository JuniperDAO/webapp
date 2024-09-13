import prisma from '@/libs/prisma'
import { redis, redlock } from '@/libs/redis'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import axios from 'axios'
import { BRIDGE_XYZ_API_URL, safeStringify } from '@/libs/constants'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/nextjs'

import { getOrCreateUserBridge, getExternalAccounts } from '@/libs/bridge-xyz/api'

// https://apidocs.bridge.xyz/docs/kyc-links
export default async (req, res) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(404)
    }

    try {
        if (!user.email && req.body?.email) {
            const userUpdate = await prisma.juniperUser.update({
                where: { id: user.id },
                data: { email: user.email || req.body?.email },
            })
            console.log(`Updated user ${user.id} with ${safeStringify(userUpdate)}`)
        }

        const email = req.body?.email || user.email
        if (!email) throw new Error(`Missing email`)

        const userBridge = await getOrCreateUserBridge(email, user.id)
        console.log(userBridge)
        const externalAccounts = await getExternalAccounts(userBridge.customerId)
        console.log(externalAccounts)

        // check to see what cardAccounts/liqudation addresses we already have
        const cardAccounts = await prisma.cardAccount.findMany({
            where: {
                ownerId: user.id,
                provider: 'bridge',
            },
        })

        return res.status(200).json({ userBridge, externalAccounts, cardAccounts })
    } catch (error) {
        console.error(`Error in /api/bridge/kyc: ${error.message}`)
        Sentry.captureException(error)
        return res.status(500).json({ error: `xyz: ${error.message}` })
    }
}
