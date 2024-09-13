import { BigNumber } from 'ethers'
import { log } from '@/libs/util/log'
import { AaveDeposit } from '@/libs/deposit/AaveDeposit'
import { getERC20Balance } from '@/libs/util/getERC20Balance'
import { AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE, safeStringify } from '@/libs/constants'
import { pollForERC20BalanceChange } from '@/libs/util/pollForBalanceChange'
import { Network } from '@/libs/network/types'
import { txnsToUserOp } from '@/libs/zerodev'
import { SessionKeySigner } from '@/libs/zerodev/SessionKeySigner'

export const depositAssetToAave = async (balancesByContract, signer: SessionKeySigner) => {
    const walletAddress = await signer.getAddress()
    const depositsBySymbol = {}
    const depositsByContract = {}

    for (const [k, v] of Object.entries(balancesByContract)) {
        const tokenAddress: string = k
        const balance: BigNumber = v as BigNumber
        const symbol = AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE.get(tokenAddress)

        log(`The user's ${symbol}:${tokenAddress} balance is: ${balance}`)

        const aaveDeposit = new AaveDeposit(signer, tokenAddress)
        const { approvalTx: depositApprovalTx, depositTx } = await aaveDeposit.prepareDeposit(balance)

        // do I need an approval here really?
        const approvalTxResponse = await signer.sendUserOperation(txnsToUserOp([depositApprovalTx])[0])
        log(`${symbol}:${tokenAddress} approval response: ${safeStringify([approvalTxResponse])}`)

        // actual deposit
        const depositTxResponse = await signer.sendUserOperation(txnsToUserOp([depositTx])[0])

        log(`Aave ${symbol}:${tokenAddress} deposit response: ${safeStringify(depositTxResponse)}`)

        depositsBySymbol[symbol] = balance
        depositsByContract[tokenAddress] = balance
    }

    log(`end deposit flow, depositsBySymbol: ${safeStringify(depositsBySymbol)}`)
    return { depositsBySymbol, depositsByContract }
}
