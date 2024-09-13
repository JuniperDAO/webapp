import { ECDSAProvider } from '@zerodev/sdk'
import { BigNumber, Signer } from 'ethers'
import { getReadProvider } from '../getReadProvider'
import { Network } from '../network/types'
import { UserOperationCallData } from '@alchemy/aa-core'

export class ZeroDevSigner extends Signer {
    private ecdsaProvider: ECDSAProvider

    constructor(provider: ECDSAProvider) {
        super()
        this.ecdsaProvider = provider
    }

    async getBalance(): Promise<BigNumber> {
        const address = await this.getAddress()
        const readProvider = getReadProvider(Network.optimism)
        return await readProvider.getBalance(address)
    }

    async sendUserOperation(userOp: UserOperationCallData | UserOperationCallData[]) {
        return await this.ecdsaProvider.sendUserOperation(userOp)
    }

    async getAddress() {
        return await this.ecdsaProvider.getAddress()
    }

    async signMessage(message: string) {
        return await this.ecdsaProvider.signMessage(message)
    }

    async signTransaction(_: any): Promise<string> {
        throw new Error('Not implemented')
    }

    async sendTransaction(_: any): Promise<any> {
        throw new Error('Not implemented')
    }

    connect(): Signer {
        throw new Error('Not implemented')
    }
}
