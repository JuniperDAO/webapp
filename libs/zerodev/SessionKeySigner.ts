import { PaymasterAndBundlerProviders, SessionKeyProvider } from '@zerodev/sdk'
import { BigNumber, Signer } from 'ethers'
import { BlockTag } from '@ethersproject/abstract-provider'
import { zeroDevProjectIdForChain } from '.'
import { Network } from '@/libs/network/types'
import { log, redactKey } from '@/libs/util/log'
import { getReadProvider } from '../getReadProvider'

import { analytics } from '@/libs/evkv'
import { safeStringify } from '../constants'

const bundlersToRotateThrough: PaymasterAndBundlerProviders[] = [
    // 'STACKUP',
    // 'ALCHEMY',
    'PIMLICO',
    // 'GELATO'
]

/**
 * This class implements the ethers Signers interface but under the hood
 * uses a zerodev session key to send transactions. This is necessary
 * because as of now 9-19-2023, the zerodev sdk does not return a clean
 * ethers signer interface for session keys. Our codebase is built around
 * the ethers signer interface, so we wrap the zerodev session key provider
 */
export class SessionKeySigner extends Signer {
    private smartWalletAddress: string
    private serializedSessionKey: string
    private sessionKeyProvider: SessionKeyProvider | null
    private bundlerProvider: PaymasterAndBundlerProviders

    constructor(smartWalletAddress: string, serializedSessionKey: string) {
        super()
        this.smartWalletAddress = smartWalletAddress
        this.serializedSessionKey = serializedSessionKey
        this.bundlerProvider = bundlersToRotateThrough[Math.floor(Math.random() * bundlersToRotateThrough.length)]
    }

    toString(): string {
        return `SessionKeySigner(smartWalletAddress: ${this.smartWalletAddress}, bundlerProvider: ${this.bundlerProvider}, serializedSessionKey: ${redactKey(this.serializedSessionKey)})`
    }

    private _initSessionKeyProvider = async (serializedSessionKey: string) => {
        const deserialized = SessionKeyProvider.deserializeSessionKeyParams(serializedSessionKey)

        const sessionKeyParams = {
            ...deserialized,
            sessionPrivateKey: deserialized.sessionPrivateKey,
        }

        const sessionKeyProvider = await SessionKeyProvider.fromSessionKeyParams({
            projectId: zeroDevProjectIdForChain(Network.optimism),
            sessionKeyParams,
            bundlerProvider: this.bundlerProvider,
            usePaymaster: false,
            opts: {
                paymasterConfig: {
                    policy: 'VERIFYING_PAYMASTER',
                    paymasterProvider: this.bundlerProvider,
                },
            },
        })
        this.log(`initialized with ${sessionKeyProvider}, project ID ${zeroDevProjectIdForChain(Network.optimism)}`)

        return sessionKeyProvider
    }

    log(str: string) {
        log(`SessionKeySigner(${this.bundlerProvider}, ${redactKey(this.serializedSessionKey)}): ${str}`)
    }

    async getAddress(): Promise<string> {
        return this.smartWalletAddress
    }

    async getBalance(blockTag?: BlockTag): Promise<BigNumber> {
        const provider = getReadProvider(Network.optimism)
        return await provider.getBalance(this.getAddress(), blockTag)
    }

    async sendSingleUserOperation(userOp: any) {
        try {
            this.log(`sendSingleUserOperation: ${JSON.stringify(userOp)}`)

            const res = await this.sessionKeyProvider.sendUserOperation(userOp)
            this.log(`... ${JSON.stringify(res)}`)
            const hash = await this.sessionKeyProvider.waitForUserOperationTransaction(res.hash as any)
            this.log(`... waitForUserOperationTransaction -> hash: ${hash}`)

            analytics.track('sendUserOperation', {
                status: 'success',
                smartWalletAddress: this.smartWalletAddress,
                bundlerProvider: this.bundlerProvider,
                serializedSessionKey: redactKey(this.serializedSessionKey),
                userOp,
                hash,
            })

            return hash
        } catch (e) {
            analytics.track('sendUserOperation', {
                status: 'failure',
                smartWalletAddress: this.smartWalletAddress,
                bundlerProvider: this.bundlerProvider,
                serializedSessionKey: redactKey(this.serializedSessionKey),
                userOp,
                error: safeStringify(e),
            })

            throw e
        }
    }

    async sendUserOperation(userOp: any) {
        if (!this.sessionKeyProvider) {
            this.sessionKeyProvider = await this._initSessionKeyProvider(this.serializedSessionKey)
        }

        if (Array.isArray(userOp)) {
            const rc = []
            for (const op of userOp) {
                rc.push(await this.sendSingleUserOperation(op))
            }
            return rc
        } else {
            return await this.sendSingleUserOperation(userOp)
        }
    }

    async signMessage(message: string): Promise<string> {
        throw new Error('SessionKeySigner: Method not implemented. If needed, implement')
    }

    async signTransaction(transaction: any): Promise<string> {
        throw new Error('SessionKeySigner: Method not implemented. If needed, implement')
    }

    async sendTransaction(transaction: any): Promise<any> {
        throw new Error('SessionKeySigner: Method not implemented. If needed, implement')
    }

    connect(provider: any): Signer {
        throw new Error('SessionKeySigner: Method not implemented. If needed, implement')
    }
}
