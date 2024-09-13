import prisma from '@/libs/prisma'
import { JuniperUser } from '@/context/user/types'
import { log } from '@/libs/util/log'
import { redlock } from '@/libs/redis'
import { safeStringify } from '@/libs/constants'
import { sendMailchimpTemplate, MailchimpSlugs } from '@/libs/mailchimp'
import { getSessionSignerByOwnerId } from './zerodev/server'

const LOCK_DURATION_MS = 1000 * 60 * 10

export async function enqueueBonusPaymentIfNeeded(referringUser: JuniperUser, referredUser: JuniperUser) {
    log(`enqueueBonusPaymentIfNeeded: ${referringUser.id} ${referredUser.id}`)
    return await redlock.using(['enqueueBonusPaymentIfNeeded', referringUser.id, referredUser.id], LOCK_DURATION_MS, async () => {
        let referral = await prisma.userReferralBonus.findUnique({
            where: {
                ownerId_referredId: {
                    ownerId: referringUser.id,
                    referredId: referredUser.id,
                },
            },
        })

        // if already paid, bail
        if (referral?.completedAt) {
            log(`enqueueBonusPaymentIfNeeded: already processed ${referringUser.id} -> ${referredUser.id} at ${referral.completedAt}`)
        } else {
            // else we try again
            log(`enqueueBonusPaymentIfNeeded: processing ${referringUser.id} -> ${referredUser.id} (found ${safeStringify(referral)})`)
            const referringSigner = await getSessionSignerByOwnerId(referringUser.id)
            const referringSCWAddress = await referringSigner.getAddress()
            const referredSigner = await getSessionSignerByOwnerId(referredUser.id)
            const referredSCWAddress = await referredSigner.getAddress()

            const data = {
                ownerId: referringUser.id,
                referredId: referredUser.id,
            }
            referral = await prisma.userReferralBonus.upsert({
                where: {
                    ownerId_referredId: {
                        ownerId: referringUser.id,
                        referredId: referredUser.id,
                    },
                },
                create: data,
                update: {
                    updatedAt: new Date(),
                    ...data,
                },
            })
            log(`enqueueBonusPaymentIfNeeded: upserted ${referringUser.id} -> ${referredUser.id} ${safeStringify(referral)}`)

            // the dates aren't the same unless you clamp to seconds
            if (referral.createdAt?.getTime() === referral.updatedAt?.getTime()) {
                sendMailchimpTemplate(referringUser.email, MailchimpSlugs.ReferralSignedUp, {
                    smartContractWalletAddress: referringSCWAddress,
                    referredSmartContractWalletAddress: referredSCWAddress,
                })
            }
        }

        return referral
    })
}
