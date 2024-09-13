import { getSessionSignerByOwnerId } from '@/libs/zerodev/server'
import { redis, redlock } from '@/libs/redis'
import { getAllStableBalances } from '@/libs/util/getERC20Balance'
import { IS_PRODUCTION, REFERRAL_BONUS_PAYER_USER_ID, safeStringify } from '@/libs/constants'
import { Network } from '@/libs/network/types'
import { addSpendingPower } from '@/libs/spendingPower/maybeAddSpendingPower'
import prisma from '@/libs/prisma'
import { analytics } from '@/libs/evkv'
import { toEth } from '@/libs/util/toEth'
import { log } from '@/libs/util/log'
import { EtherscanTransfersClient } from '@/libs/transactionHistory/EtherscanTransfersClient'
import * as Sentry from '@sentry/nextjs'
import { sendMailchimpTemplate, MailchimpSlugs } from '@/libs/mailchimp'
import {
    MAX_REFERRALS_PER_USER,
    MAX_REFERRALS_PER_DAY,
    MIN_DAILY_BALANCE_USD,
    DAILY_BALANCE_LOOKBACK_DAYS,
    DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS,
} from '@/libs/constants'
import { BigNumber } from 'ethers'

// curl -X POST -H "Content-Type: application/json" -d '{"id":"4bf2878a-2601-481e-a986-25a9442338c5"}' http://localhost:3000/api/workflows/referrals/pay
export default async (req, res) => {
    // cutoff higher tiers after 7/4/2024
    const currentDate = new Date()
    const cutoffDate = new Date(2024, 6, 4) // July 4th
    const isAfterBonusCutoff = currentDate > cutoffDate

    if (req.method === 'POST') {
        const { id } = req.body // will only have the ID
        if (!id) {
            return res.status(400).json({ error: `Not found: ${id}` })
        }

        // this is very similar to intent processing, but not quite the same
        await redlock.using([`bonus/pay:${id}`], 3600 * 1000, async () => {
            const bonus = await prisma.userReferralBonus.findUnique({
                where: {
                    id: id,
                },
            })

            if (!bonus) {
                log(`bonus ${id} not found`)
                return res.status(404).json({ error: 'Not Found' })
            } else {
                log(`processing bonus: ${id})`)
            }

            if (bonus.completedAt) {
                log(`bonus ${id} already paid: ${safeStringify(bonus)}`)
                return res.status(204).end()
            }

            try {
                // use a session key for the Juniper corp treasury to pay the bonus
                // the user ID to use is stored in an env secret, then get a session key signer for that user
                const referrerSigner = await getSessionSignerByOwnerId(bonus.ownerId, Network.optimism)
                const referrerSCWAddress = await referrerSigner.getAddress()
                const bonusData = JSON.parse(bonus.bonusData as string) || {}

                if (!IS_PRODUCTION) {
                    bonusData['amount'] = 1
                }

                const referrer = await prisma.juniperUser.findUnique({
                    where: {
                        id: bonus.ownerId,
                    },
                })
                if (!referrer) {
                    log(`bonus ${id} referring user not found)`)
                    return res.status(404).json({ error: 'Referring user not found' })
                }

                const referred = await prisma.juniperUser.findUnique({
                    where: {
                        id: bonus.referredId,
                    },
                })

                if (!referred) {
                    log(`bonus ${id} referred user not found)`)
                    return res.status(404).json({ error: 'Referred user not found' })
                }

                const fourteenDaysAgo = new Date(new Date().getTime() - DAILY_BALANCE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)

                if (referred.createdAt > fourteenDaysAgo) {
                    const retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString()
                    log(`bonus ${id} ${bonus.referredId} is too new: ${referred.createdAt}`)
                    return res
                        .status(429)
                        .setHeader('Retry-After', retryAfter)
                        .json({ error: `Referred user is too new: ${referred.createdAt})` })
                }

                // check the average daily balance for the trailing N days
                const referredSigner = await getSessionSignerByOwnerId(bonus.referredId, Network.optimism)
                const referredSCWAddress = await referredSigner.getAddress()
                // '0xf2E1beC89BDE957180a695f58b0f5841f8c655DB' is a good test account
                const etherscan = new EtherscanTransfersClient({ address: referredSCWAddress })

                // transaction lookback is longer in case we miss a cron run
                const txnBalance = await etherscan.getAverageDailyBalance(DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS)

                let stableBalance = BigNumber.from(0)
                if (!isAfterBonusCutoff) {
                    stableBalance = await getAllStableBalances(referredSCWAddress, Network.optimism)
                }

                const totalUSDBalance = txnBalance + toEth(stableBalance)
                log(
                    `bonus ${id} ${bonus.referredId} has txn balance ${txnBalance}, stables ${toEth(stableBalance)}, total ${totalUSDBalance} over the last ${DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS} days`
                )

                if (totalUSDBalance < MIN_DAILY_BALANCE_USD) {
                    const retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString()
                    log(`bonus ${id} ${bonus.referredId} has average balance too low ${totalUSDBalance} until ${retryAfter}`)
                    return res
                        .status(429)
                        .setHeader('Retry-After', retryAfter)
                        .json({ error: `Balance requirement not met (balance; ${totalUSDBalance})` })
                }

                log(
                    `bonus ${id} ${bonus.referredId} qualifies with USD balance ${totalUSDBalance} over the last ${DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS} days`
                )

                // implement limits per recipient - 5 per month
                const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
                const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)

                const referringCount = await prisma.userReferralBonus.count({
                    where: {
                        ownerId: bonus.ownerId,
                        completedAt: {
                            gte: startOfMonth,
                            lte: endOfMonth,
                        },
                    },
                })

                if (referringCount > MAX_REFERRALS_PER_USER) {
                    const retryAfter = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).toUTCString()
                    log(`bonus ${id} ${bonus.ownerId} has too many referrals: ${referringCount} until ${retryAfter}`)
                    return res.status(429).setHeader('Retry-After', retryAfter).json({ error: 'Too many referrals' })
                }

                // implement limits per day (global)
                const r = redis()
                const referralCounterKey = `referralCounter:${bonus.ownerId}:${new Date().toISOString().slice(0, 10)}`
                const referralCount = await r.get(referralCounterKey)
                if (referralCount && Number(referralCount) >= MAX_REFERRALS_PER_DAY) {
                    const retryAfter = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString()
                    log(`global referralCount exceeded ${referralCount} until ${retryAfter}`)
                    return res.status(429).setHeader('Retry-After', retryAfter).json({ error: 'Too many referrals' })
                }
                await r.incr(referralCounterKey)

                // determine the amount to pay:
                // start with bonusData['amount'] in USDC, this is the base amount
                // for more deposits, pay more!
                if (!isAfterBonusCutoff && totalUSDBalance > 1000) {
                    bonusData['amount'] = 150 // implied 15% bonus rate
                } else if (totalUSDBalance > 100) {
                    bonusData['amount'] = 10 // implied 10% rate
                } else {
                    bonusData['amount'] = 5 // implied 5% rate
                }

                // lastly, gamble zone. 1/5000 chance of getting $250 bonus
                const gambleWinner = Math.random() < 1 / 5000
                if (bonusData['amount']) {
                    if (gambleWinner) {
                        bonusData['amount'] = 250
                    }
                }

                log(
                    `bonus ${id} ${bonus.referredId} has a balance of ${totalUSDBalance} USD, paying ${bonusData['amount']} USDC to ${referrerSCWAddress} and ${referredSCWAddress} (gambleWinner: ${gambleWinner})`
                )

                // pay the referrer
                await addSpendingPower(REFERRAL_BONUS_PAYER_USER_ID, referrerSCWAddress, bonusData['amount'], 'referral')

                // pay the referred
                await addSpendingPower(REFERRAL_BONUS_PAYER_USER_ID, referredSCWAddress, bonusData['amount'], 'referral')

                analytics.track('referralBonusPaid', { bonus, referrerSCWAddress, referredSCWAddress, payerUserId: REFERRAL_BONUS_PAYER_USER_ID })

                await prisma.userReferralBonus.update({
                    where: {
                        id: id,
                    },
                    data: {
                        completedAt: new Date(),
                    },
                })

                const properties = {
                    referrerEmail: referrer.email,
                    referrerSmartContractWalletAddress: referrerSCWAddress,
                    referredEmail: referred.email,
                    referredSmartContractWalletAddress: referredSCWAddress,
                    ...bonusData,
                }

                sendMailchimpTemplate(referrer.email, MailchimpSlugs.ReferralPaid, properties)
                sendMailchimpTemplate(referred.email, MailchimpSlugs.ReferredPaid, properties)

                log(`bonus ${id} ${bonus.referredId} paid successfully`)
                return res.status(200).json({ results: bonus })
            } catch (e) {
                console.error(e)
                Sentry.captureException(e)
                return res.status(503).json({ error: 'Probable Blockchain Bullshit' })
            }
        })
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }
}
