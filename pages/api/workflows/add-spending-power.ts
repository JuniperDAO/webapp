import { CardAccount } from '@prisma/client'
import { completeIntent } from '@/libs/workflows'
import { addSpendingPowerToCard } from '@/libs/spendingPower/maybeAddSpendingPower'
import { getCardAccountDisplayInfo } from '@/context/CardAccounts/CardAccounts'
import { sendMailchimpTemplate, MailchimpSlugs } from '@/libs/mailchimp'
import { log } from '@/libs/util/log'

export default async (req_, res_) => {
    if (req_.method === 'POST') {
        return await completeIntent(req_, res_, async function (req, res) {
            const { cardAccountId, desiredSpendingPowerUSD } = req.body
            if (!cardAccountId) throw new Error(`Missing cardAccountId`)
            if (!desiredSpendingPowerUSD) throw new Error(`Missing spending power to add`)

            const cardAccount: CardAccount = await prisma.cardAccount.findUnique({
                where: {
                    id: cardAccountId,
                },
            })
            if (!cardAccount) {
                // 404 will short circuit the deferred execution
                log(`card account ${cardAccountId} not found`)
                return res.status(404).json({ error: true })
            }

            const user = await prisma.juniperUser.findUnique({
                where: {
                    id: cardAccount.ownerId,
                },
            })
            if (!user) {
                // 404 will short circuit the deferred execution
                log(`juniper user ${cardAccount.ownerId} not found`)
                return res.status(404).json({ error: true })
            }

            const userSmartWallet = await prisma.userSmartWallet.findFirst({
                where: {
                    ownerId: user.id,
                },
            })
            if (!userSmartWallet) {
                // 404 will short circuit the deferred execution
                log(`smart wallet for juniper user ${user.id} not found`)
                return res.status(404).json({ error: true })
            }

            const displayInfo = getCardAccountDisplayInfo(cardAccount)
            let properties = {
                smartContractWalletAddress: userSmartWallet.smartContractWalletAddress,
                amount: desiredSpendingPowerUSD.toFixed(2),
                ...displayInfo,
            }
            // sendMailchimpTemplate(user.email, MailchimpSlugs.SendMoneyStarted, properties)

            const txids = await addSpendingPowerToCard(cardAccount, desiredSpendingPowerUSD)
            Object.keys(txids).forEach((key) => {
                properties[`txid_${key}`] = txids[key]
            })

            sendMailchimpTemplate(user.email, MailchimpSlugs.SendMoneyCompleted, properties)
        })
    } else {
        return res_.status(405).json({ error: 'Method Not Allowed' })
    }
}
