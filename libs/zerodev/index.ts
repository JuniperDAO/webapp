import { Network } from '@/libs/network/types'

import { SessionKeyProvider, ECDSAProvider, constants as zeroDevConstants } from '@zerodev/sdk'

import { GET, POST } from '../request'
import { ethers, PopulatedTransaction } from 'ethers'
import { LocalAccountSigner, UserOperationCallData } from '@alchemy/aa-core'
import { SessionPermissions } from './SessionPermissions'
import { SESSION_KEY_EXPIRATION_S, safeStringify } from '../constants'

import { log } from '@/libs/util/log'

export const zeroDevProjectIdForChain = (chain: Network) => {
    switch (chain) {
        case Network.optimism:
            return process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID_OPTIMISM
    }

    throw new Error(`No ZeroDev project ID for chain ${chain}`)
}

/**
 * NOTE: Zerodev session key documentation can be found here:
 * https://docs.zerodev.app/use-wallets/use-session-keys
 */

export const createAndSaveSessionSigner = async (ecdsaProvider: ECDSAProvider): Promise<string> => {
    // provider is from usePrivySmartAccount
    const res = await GET<any>('/api/card-accounts/receive-addresses')
    if (res.status !== 200) {
        throw new Error(res.data?.error || 'Failed to get receive addresse')
    }

    const { addresses } = res.data
    log(`createAndSaveSessionSigner: receive addresses: ${safeStringify(addresses)}`)

    const { sessionPrivateKey, sessionKeyProvider } = await createAndSignNewZeroDevSessionKey(addresses, ecdsaProvider)

    const serializedSessionKeyParams = await sessionKeyProvider.serializeSessionKeyParams(sessionPrivateKey)

    const address = await sessionKeyProvider.getAddress()
    log(`createAndSaveSessionSigner: getAddress: ${address}`)

    const { status, data } = await POST('/api/wallet/save', {
        address,
        sessionKey: serializedSessionKeyParams,
    })
    console.log(`createAndSaveSessionSigner: POST /api/wallet/save: ${JSON.stringify({ status, data })}`)

    if (!(status === 200)) {
        throw new Error('Failed to create session signer' + data)
    }

    return serializedSessionKeyParams
}

// The master signer must sign a new session key for it to be effective
export const createAndSignNewZeroDevSessionKey = async (addresses: string[], ecdsaProvider: ECDSAProvider) => {
    const { sessionKey, sessionPrivateKey } = generateZeroDevSessionKey()
    const VALID_INDEFINITELY = 0

    const sessionKeyProvider = await SessionKeyProvider.init({
        projectId: zeroDevProjectIdForChain(Network.optimism),
        defaultProvider: ecdsaProvider,
        sessionKey,
        sessionKeyData: {
            // permissions: allPerms,
            // TODO this isn't right! We need to set the permissions to the whitelist
            paymaster: zeroDevConstants.oneAddress,

            // until we have a better way to handle this, we will set the session key to expire
            // https://docs.zerodev.app/sdk/plugins/session-keys#validuntil
            validUntil: Math.floor(Date.now() / 1000) + SESSION_KEY_EXPIRATION_S,
            validAfter: VALID_INDEFINITELY,
        },
    })

    return {
        sessionKeyProvider,
        sessionKey,
        sessionPrivateKey,
    }
}

export const generateZeroDevSessionKey = () => {
    const privateKey = generateECDSAPrivateKey()
    return {
        sessionKey: LocalAccountSigner.privateKeyToAccountSigner(privateKey),
        sessionPrivateKey: privateKey,
    }
}

export const generateECDSAPrivateKey = (): `0x${string}` => {
    return ethers.Wallet.createRandom().privateKey as `0x${string}`
}

export const txnsToUserOp = (txns: PopulatedTransaction[]): UserOperationCallData[] => {
    return txns.map((txn: PopulatedTransaction): UserOperationCallData => {
        const { to, data, value, ...restOfTxn } = txn

        const valueObj = value ? { value: value.toBigInt() } : {}

        return {
            ...restOfTxn,
            ...valueObj,
            target: to as `0x${string}`,
            data: data as `0x${string}`,
        }
    })
}
