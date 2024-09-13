import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { NextApiRequest, NextApiResponse } from 'next'
import prisma from '@/libs/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) return res.status(404).json({ error: 'User not found' })

    // should we cache this?
    let addresses = []
    const cardAccounts = await prisma.cardAccount.findMany({
        where: {
            ownerId: user.id,
            address: { not: null },
        },
        select: {
            address: true,
        },
    })

    addresses.push(...cardAccounts.map((cardAccount) => cardAccount.address))

    res.status(200).json({ addresses })
}
