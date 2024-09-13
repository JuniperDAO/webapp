import prisma from '@/libs/prisma'
import { Prisma } from '@prisma/client'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { NextApiRequest, NextApiResponse } from 'next'
import { log } from '@/libs/util/log'
import * as Sentry from '@sentry/nextjs'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(404).json({ error: 'Not found' })
    }

    if (req.method === 'POST') {
        const { walletName, selectedExchangeType, walletAddress } = req.body

        const cardAccount = await prisma.cardAccount.upsert({
            where: {
                ownerId_address: {
                    ownerId: user.id,
                    address: walletAddress,
                },
            },
            create: {
                ownerId: user.id,
                provider: selectedExchangeType || 'wallet',
                name: walletName,
                address: walletAddress,
            },
            update: {
                name: walletName,
            },
        })

        res.status(200).json({
            error: false,
            cardAccounts: [cardAccount],
        })
    } else {
        res.status(400).json({
            error: 'Bad request',
        })
    }
}
