import { Exchange, PrepareSwapArgs, SwapTransactions } from './Exchange'

import { AlphaRouter, SwapOptionsSwapRouter02, SwapType } from '@uniswap/smart-order-router'
import { TradeType, CurrencyAmount, Percent, Token, ChainId } from '@uniswap/sdk-core'
import { ethers, BigNumber, Signer, PopulatedTransaction } from 'ethers'
import { ERC20_ABI } from './ERC20Abi'
import { getReadProvider } from '../getReadProvider'
import { Network } from '../network/types'

// same on optimism and mainnet
export const V3_SWAP_ROUTER_ADDRESS = '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45'

export class UniswapExchange extends Exchange {
    constructor(signer: Signer) {
        super(signer)
    }

    public async prepareSwap({ amount, fromTokenAddress, toTokenAddress, fromDecimals = 18, toDecimals = 18 }: PrepareSwapArgs): Promise<SwapTransactions> {
        const amountHex = amount.toHexString()

        const fromToken = new Token(ChainId.OPTIMISM, fromTokenAddress, fromDecimals)

        const toToken = new Token(ChainId.OPTIMISM, toTokenAddress, toDecimals)

        const approvalTxn = await this.prepareTokenTransferApproval(fromToken, amountHex)

        const swapTxn = await this.generateRouteTxn(amountHex, fromToken, toToken)

        return {
            approvalTxn,
            swapTxn,
        }
    }

    private async prepareTokenTransferApproval(
        token: Token,
        amountHex: string // hex string
    ): Promise<null | any> {
        const tokenContract = new ethers.Contract(token.address, ERC20_ABI)

        const transaction = await tokenContract.populateTransaction.approve(V3_SWAP_ROUTER_ADDRESS, amountHex)

        return transaction
    }

    private async generateRouteTxn(
        amountHex: string, // hex string
        fromToken: Token,
        toToken: Token
    ): Promise<PopulatedTransaction> {
        const walletAddress = await this.signer.getAddress()

        const router = new AlphaRouter({
            chainId: ChainId.OPTIMISM,
            provider: getReadProvider(Network.optimism),
        })

        const THIRTY_MINUTES = 1800

        const options: SwapOptionsSwapRouter02 = {
            recipient: walletAddress,
            slippageTolerance: new Percent(50, 10_000), // 50 bips, or 0.50%
            deadline: Math.floor(Date.now() / 1000 + THIRTY_MINUTES),
            type: SwapType.SWAP_ROUTER_02,
        }

        const route = await router.route(CurrencyAmount.fromRawAmount(fromToken, amountHex), toToken, TradeType.EXACT_INPUT, options)

        if (!route) {
            throw new Error('No route found')
        }

        // return the transaction
        return {
            data: route.methodParameters?.calldata,
            to: V3_SWAP_ROUTER_ADDRESS,
            value: BigNumber.from(route?.methodParameters?.value),
        }
    }
}
