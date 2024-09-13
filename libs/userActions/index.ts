import prisma from '@/libs/prisma'
import { JuniperUser } from '@/context/user/types'
import { User } from '@privy-io/react-auth'
import type { User as ServerUser } from '@privy-io/server-auth'
import { safeStringify } from '@/libs/constants'
import { log } from '@/libs/util/log'
import { redlock } from '@/libs/redis'
import { NEW_USER_CREATION_LOCK_DURATION_MS } from '@/libs/constants'
import { enqueueBonusPaymentIfNeeded } from '@/libs/referrals'

const parsePrivyEmailAddress = (privyUser: User | ServerUser): string => {
    if (privyUser.email?.address) {
        return privyUser.email.address
    }

    if (privyUser.google?.email) {
        return privyUser.google.email
    }

    if (privyUser.apple?.email) {
        return privyUser.apple.email
    }

    if (privyUser.discord?.email) {
        return privyUser.discord.email
    }

    return null
}

export const findOrCreateJuniperUserByPrivyUser = async (user: ServerUser, create: boolean = false, metadata: any = {}): Promise<JuniperUser | null> => {
    const email = parsePrivyEmailAddress(user)
    let lockKeys = []
    let whereClause = {
        OR: [],
    }
    if (email) {
        whereClause.OR.push({ email: email })
        lockKeys.push(email)
    }
    if (user.id) {
        whereClause.OR.push({ did: user.id })
        lockKeys.push(user.id)
    }
    if (user.wallet?.address) {
        whereClause.OR.push({ eoaWalletAddress: user.wallet.address })
        lockKeys.push(user.wallet.address)
    }

    if (!whereClause.OR.length) {
        throw new Error(`findJuniperUserByPrivyUser: invalid whereClause ${safeStringify(whereClause)}`)
    }

    // console.debug(`search ${safeStringify(whereClause)}`)
    // console.debug(`locking ${safeStringify(lockKeys)}`)

    const _ = async (signal) => {
        let { referredBy } = metadata

        const users = await prisma.juniperUser.findMany({
            where: whereClause,
            include: {
                smartWallets: true,
                cardAccounts: true,
            },
        })

        let returnedUser: JuniperUser = null
        let isNewlyCreated: Boolean = false
        if (users.length === 0) {
            console.log(`no users found for ${safeStringify(whereClause)}`)
            if (create) {
                log(`user ${safeStringify(user)} does not exist, creating (metadata: ${safeStringify(metadata)}`)
                returnedUser = await prisma.juniperUser.create({
                    data: {
                        did: user.id,
                        email: email,
                        eoaWalletAddress: user.wallet?.address,
                        referredBy: referredBy,
                    },
                })
                if (!returnedUser) throw new Error(`Failed to create user from ${safeStringify(user)}`)
                isNewlyCreated = true
            }
        } else if (users.length > 1) {
            // console.error('too many users', users)
            throw new Error(`multiple users found for ${safeStringify(whereClause)}`)
        } else {
            // console.debug('found', users[0])
            const data: any = {
                updatedAt: new Date(),
                did: user.id,
                email: email,
                eoaWalletAddress: user.wallet?.address,
            }
            if (referredBy) {
                if (users[0].referredBy) {
                    if (users[0].referredBy !== referredBy) {
                        log(`${users[0].id} already referred by ${users[0].referredBy}, asked for ${referredBy}`)
                    } else {
                        log(`${users[0].id} already referred by ${referredBy}`)
                    }
                } else {
                    if (isNewlyCreated) {
                        console.log(`updating referral by for ${users[0].id} to ${referredBy}`)
                        data.referredBy = referredBy
                    } else {
                        console.log(`${users[0].id} asked for ${referredBy} but user is not new`)
                    }
                }
            }
            const res = await prisma.juniperUser.updateMany({
                where: whereClause,
                data: data,
            })
            if (!res?.count) throw new Error(`Failed to update user from ${safeStringify(user)}`)

            returnedUser = users[0]
        }

        if (referredBy) {
            const referredByUser = await prisma.juniperUser.findUnique({
                where: { referralCode: referredBy },
            })

            if (referredByUser) {
                await enqueueBonusPaymentIfNeeded(referredByUser, returnedUser)
            } else {
                log(`referredBy ${referredBy} not found`)
                referredBy = null
            }
        }

        return returnedUser
    }

    return redlock.using(lockKeys, NEW_USER_CREATION_LOCK_DURATION_MS, _)
}
