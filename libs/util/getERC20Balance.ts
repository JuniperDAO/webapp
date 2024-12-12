import { getReadProvider } from '../getReadProvider'
import { ethers, BigNumber } from 'ethers'
import { ERC20_ABI } from '../exchange/ERC20Abi'
import { Network } from '@/libs/network/types'
import { tokenDecimalsToWei } from './units'
import { AAVE_SUPPLIABLE_ERC20_ADDRESSES, AAVE_SUPPORTED_STABLES } from '@/libs/constants'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { log } from './log'
import { toEth } from './toEth'

export const getERC20Balance = async (address: string, chain: Network, contractAddress: string) => {
    try {
        const provider = getReadProvider(chain)
        await provider.ready

        const erc20Contract = new ethers.Contract(contractAddress, ERC20_ABI, provider)
        const balanceTokenDecimals = await erc20Contract.balanceOf(address)

        return tokenDecimalsToWei(balanceTokenDecimals, contractAddress)
    } catch (e) {
        log(`getERC20Balance error: ${e}`)
        return BigNumber.from(0)
    }
}

export const getAllERC20Balances = async (address: string, chain: Network) => {
    const balancesByContract = {}
    const balancesBySymbol = {}

    await Promise.all(
        Object.entries(AaveV3Optimism.ASSETS).map(async ([symbol, info]) => {
            if (AAVE_SUPPLIABLE_ERC20_ADDRESSES.get(symbol)) {
                const balance = await getERC20Balance(address, chain, info.UNDERLYING)
                console.log(`Balance of ${symbol}: ${toEth(balance)}`)
                if (balance.gt(0)) {
                    balancesByContract[info.UNDERLYING] = balance
                    balancesBySymbol[symbol] = balance
                }
            }
        })
    )

    return { balancesByContract, balancesBySymbol }
}

export const getAllATokenBalances = async (address: string, chain: Network) => {
    const balances = {}

    for (const [symbol, info] of Object.entries(AaveV3Optimism.ASSETS)) {
        if (AAVE_SUPPLIABLE_ERC20_ADDRESSES.get(symbol) || AAVE_SUPPORTED_STABLES.indexOf(symbol) !== -1) {
            const aBalance = await getERC20Balance(address, chain, info.A_TOKEN)
            console.log(`Balance of ${symbol} at Aave: ${toEth(aBalance)}`)
            if (aBalance.gt(0)) {
                balances[info.UNDERLYING] = aBalance
            }

            const uBalance = await getERC20Balance(address, chain, info.UNDERLYING)
            console.log(`Balance of ${symbol} in wallet: ${toEth(uBalance)}`)
            if (uBalance.gt(0)) {
                balances[info.UNDERLYING] = aBalance.add(uBalance)
            }
        }
    }

    return balances
}

export const getAllStableBalances = async (address: string, chain: Network) => {
    const allBalances = await Promise.all(
        AAVE_SUPPORTED_STABLES.map(async (symbol) => {
            const balance = await getERC20Balance(address, chain, AaveV3Optimism.ASSETS[symbol].UNDERLYING)
            return balance
        })
    )

    return allBalances.reduce((acc, balance) => acc.add(balance), BigNumber.from(0))
}
