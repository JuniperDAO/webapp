import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import prisma from '@/libs/prisma'

// verbs for referrals
// PUT / - set your referralCode
// GET / - get your referredBy, referralCode, and statistics
// PUT /[referralCode] - add yourself as a referral of that user
// GET /[referralCode] - get info on the user with that referralCode

export default async function handle(req, res) {
    const user = await userFromTokenMiddleware(req, res)
    const referralCodeRegex = /^(?=.*[A-Za-z])[A-Za-z0-9_]+$/

    if (!user) return res.status(404).json({ error: 'User not found' })

    if (req.method === 'GET') {
        res.status(200).json({
            referredBy: user.referredBy,
            referralCode: user.referralCode,
            referralCount: user.referralCode
                ? await prisma.juniperUser.count({
                      where: {
                          referredBy: user.referralCode,
                      },
                  })
                : 0,
        })
    } else if (req.method === 'PUT') {
        const { referralCode } = req.body

        if (!referralCodeRegex.test(referralCode)) {
            res.status(400).json({
                error: true,
                message: `"${referralCode}" is not a valid referralCode. Use only letters, numbers, and underscores.`,
            })
        } else if (user.referralCode) {
            res.status(400).json({
                error: true,
                message: 'User already has a referralCode set',
            })
        } else {
            const existingUserWithReferralCode = await prisma.juniperUser.findFirst({
                where: {
                    referralCode: {
                        equals: referralCode,
                        mode: 'insensitive',
                    },
                },
            })

            if (existingUserWithReferralCode) {
                res.status(400).json({
                    error: true,
                    message: `Referral code ${referralCode} already exists`,
                })
            } else {
                await prisma.juniperUser.update({
                    where: {
                        id: user.id,
                    },
                    data: {
                        referralCode: referralCode,
                    },
                })
                res.status(200).json({
                    referralCode: referralCode,
                })
            }
        }
    }
}
