import { ethers, Signer } from 'ethers'
import { getReadProvider } from '../getReadProvider'
import { Network } from '../network/types'

export const fetchSignerBalanceEther = async (signer: Signer) => {
    const balanceWei = await signer.getBalance()
    const balanceEther = ethers.utils.formatEther(balanceWei)

    return parseFloat(balanceEther)
}

export const fetchAddressBalanceEther = async (address: string, network: Network) => {
    const balanceWei = await fetchAddressBalanceWei(address, network)
    const balanceEther = ethers.utils.formatEther(balanceWei)

    return parseFloat(balanceEther)
}

export const fetchAddressBalanceWei = async (address: string, network: Network) => {
    const provider = getReadProvider(network)
    const balanceWei = await provider.getBalance(address)

    return balanceWei
}
