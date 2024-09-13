import prisma from '@/libs/prisma'
import { Intent } from '@prisma/client'
import { executeIntent } from '@/libs/workflows'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import type { CardAccount } from '@prisma/client'
import { log } from '@/libs/util/log'

export default async (req, res) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'POST') {
        const amountUSD = req.body.amountUSD
        const id = req.query.id

        if (!amountUSD) {
            res.status(400).json({
                error: true,
                message: 'amountUSD is required',
            })
            return
        }

        // this is just here mostly as a valid ID check before handing the process to the deferred workflow
        const cardAccount: CardAccount = await prisma.cardAccount.update({
            where: {
                id,
            },
            data: {
                updatedAt: new Date(),
            },
        })
        if (!cardAccount) {
            return res.status(404).json({ error: true })
        }

        log(`adding spending power to card account ${id} amount ${amountUSD}`)
        if (await executeIntent('add-spending-power', user.id, Intent.borrow_and_send, { cardAccountId: cardAccount.id, desiredSpendingPowerUSD: amountUSD })) {
            res.status(200).json({
                error: false,
                amountUSD: amountUSD,
                cardAccount: cardAccount,
            })
        } else {
            res.status(500).json({
                error: true,
                message: 'Send failed',
            })
        }
    } else {
        res.status(400).json({
            error: true,
            message: 'bad verb',
        })
    }
}
