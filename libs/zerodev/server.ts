import prisma from '@/libs/prisma'
import { Network } from '@/libs/network/types'
import { Signer } from 'ethers'
import { log } from '../util/log'
import { SessionKeySigner } from './SessionKeySigner'

export type SessionData = {
    sessionSigner: Signer
    smartWalletAddress: string
}

export const getSessionSignerByOwnerId = async (userOwnerId: string, network: Network = Network.optimism) => {
    if (!userOwnerId) {
        throw new Error(`${userOwnerId} is invalid`)
    }

    const userSmartWallet = await prisma.userSmartWallet.findFirst({
        orderBy: {
            updatedAt: 'desc',
        },
        where: {
            network: {
                equals: network,
            },
            ownerId: userOwnerId,
            deletedAt: {
                equals: null,
            },
        },
    })
    if (!userSmartWallet) {
        throw new Error(`No user smart wallet found for ${userOwnerId}`)
    }

    const signer = new SessionKeySigner(userSmartWallet.smartContractWalletAddress, userSmartWallet.sessionKey)

    // log(`getSessionSignerByOwnerId(${userOwnerId}, ${network}) -> Signer(${userSmartWallet.smartContractWalletAddress})`)

    return signer
}
