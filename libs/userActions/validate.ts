import { JuniperUser } from '@/context/user/types'
import { privy } from '@/libs/privyServer'
import { analytics } from '@/libs/evkv'
import { safeStringify } from '../constants'
import prisma from '../prisma'
import { findOrCreateJuniperUserByPrivyUser } from '@/libs/userActions'
import { log } from '../util/log'
import * as Sentry from '@sentry/nextjs'

export const userFromToken = async (req, res, metadata: any = {}): Promise<JuniperUser> => {
    const authToken = await req.headers.authorization?.replace('Bearer ', '')
    const verifiedClaims = await privy.verifyAuthToken(authToken)
    const user = await privy.getUser(verifiedClaims.userId)

    if (!user) throw new Error(`Privy not found: ${verifiedClaims.userId}`)

    const juniperUser = await findOrCreateJuniperUserByPrivyUser(user, true, metadata)
    if (!juniperUser) throw new Error(`Could not find or create user: ${safeStringify(user)}`)

    analytics.identify(juniperUser.id, {
        did: juniperUser.did,
        email: juniperUser.email,
        wallet: user.wallet,
    })

    return juniperUser
}

export async function userFromTokenMiddleware(req, res, metadata: any = {}): Promise<JuniperUser> {
    try {
        return await userFromToken(req, res, metadata)
    } catch (e) {
        if (e.code === 'ERR_JWS_INVALID') {
            log(`ERR_JWS_INVALID: ${req.headers.authorization}`)
        } else {
            console.error(e)
        }
        return null
    }
}
