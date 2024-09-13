import prisma from '@/libs/prisma'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'

import * as Sentry from '@sentry/nextjs'

export default async (req, res) => {
    throw new Error('Referrals are disabled for your account')

    const id = req.query.id
    const referring = await prisma.juniperUser.findUnique({
        where: {
            referralCode: id,
        },
    })

    if (req.method === 'GET') {
        // this method is public
        if (referring) {
            res.status(200).json({
                referredBy: referring.referredBy,
                referralCode: referring.referralCode,
                referralCount: referring.referralCode
                    ? await prisma.juniperUser.count({
                          where: {
                              referredBy: referring.referralCode,
                          },
                      })
                    : 0,
            })
        } else {
            res.status(404).json({
                error: true,
                message: `referralCode ${id} not found`,
            })
        }
    } else if (req.method === 'PUT') {
        const user = await userFromTokenMiddleware(req, res)
        if (!user) return res.status(401).json({ error: 'Unauthorized' })

        if (user.referredBy) {
            res.status(400).json({
                error: true,
                message: 'User already has a referrer set',
            })
        } else if (user.referralCode === id) {
            res.status(400).json({
                error: true,
                message: 'Cannot set referrer to your own referral code',
            })
        } else {
            if (referring) {
                await prisma.juniperUser.update({
                    where: {
                        id: user.id,
                    },
                    data: {
                        referredBy: id,
                    },
                })

                res.status(200).json({
                    referredBy: id,
                })
            } else {
                res.status(404).json({
                    error: true,
                    message: `referralCode ${id} not found`,
                })
            }
        }
    }
}
