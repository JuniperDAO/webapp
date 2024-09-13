import prisma from '@/libs/prisma'
import { enqueueBonusPaymentIfNeeded } from '@/libs/referrals'
import { log } from '@/libs/util/log'

export default async (req, res) => {
    if (req.method === 'GET') {
        // pre-stage: iterate all referrals, enqueue bonus payments if needed
        const referredUsers = await prisma.juniperUser.findMany({
            where: {
                referredBy: { not: null },
                email: { not: { endsWith: '.eu' } },
            },
        })
        for (const referredUser of referredUsers) {
            const referringUser = await prisma.juniperUser.findUnique({ where: { referralCode: referredUser.referredBy } })
            if (referringUser) {
                try {
                    await enqueueBonusPaymentIfNeeded(referringUser, referredUser)
                } catch (e) {
                    log(`Error processing ${referringUser.id}: ${e}`)
                }
            } else {
                log(`${referredUser.id} referring user not found: ${referredUser.referredBy}`)
            }
        }

        const bonuses = await prisma.userReferralBonus.findMany({
            where: {
                completedAt: null,
            },
            select: {
                id: true,
                referredId: true,
            },
        })

        return res.status(200).json({
            results: bonuses
                .map((bonus) => {
                    return { id: bonus.id }
                })
                .filter(Boolean),
        })
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }
}
