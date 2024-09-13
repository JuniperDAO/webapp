import { fetchAddressBalanceWei } from '@/libs/util/fetchSignerBalanceEther'
import { Network } from '@/libs/network/types'
import { useEffect, useState } from 'react'
import { BigNumber } from 'ethers'
import { getERC20Balance } from '@/libs/util/getERC20Balance'
import { log } from '@/libs/util/log'
import { toEth } from '@/libs/util/toEth'
import { ETH_DEPOSIT_POLL_INTERVAL } from '../libs/constants'
import { analytics } from '@/libs/evkv'

/*
 * Tracks if a user has:
 * a) sufficient funds of a given token for the next operation
 * b) deposited funds into their wallet since the component mounted.
 * If so, it returns the amount
 */
export type TrackedAsset = {
    symbol: string
    assetAddress: string
    amount: BigNumber
}

const _depositTracker = (
    walletAddress: string,
    network: Network,
    symbol: string | null,
    assetAddress: string,
    minDepositThresholdWei: BigNumber,
    notifyOnExistingBalance: boolean
) => {
    const [deposit, setDeposit] = useState<TrackedAsset>({
        symbol: symbol || 'ETH',
        assetAddress: assetAddress,
        amount: BigNumber.from(0),
    })
    const [previousBalance, setPreviousBalance] = useState<BigNumber | null>(null)

    // a minimum value is now a requirement
    if (minDepositThresholdWei.lt(0)) {
        throw new Error(`Negative minimum deposit given: ${minDepositThresholdWei}`)
    }

    // Fetch initial balance when the address changes
    useEffect(() => {
        if (!walletAddress) {
            return
        }

        const fetchInitialBalance = async (address: string) => {
            // if asset address given, ERC-20 tracking mode
            let initialBalance = BigNumber.from(0)

            if (assetAddress) {
                initialBalance = await getERC20Balance(address, network, assetAddress)
            } else {
                initialBalance = await fetchAddressBalanceWei(address, network)
            }

            analytics.track('fetchInitialBalance', {
                address: address,
                network: network,
                assetAddress: assetAddress,
                eth: toEth(initialBalance),
            })

            setPreviousBalance(initialBalance)
        }

        fetchInitialBalance(walletAddress)
    }, [walletAddress])

    // Start tracking the balance with interval once the initial balance is fetched
    useEffect(() => {
        if (previousBalance === null || !walletAddress) return

        async function _poll() {
            let balance = BigNumber.from(0)

            if (assetAddress) {
                balance = await getERC20Balance(walletAddress, network, assetAddress)
                console.debug(`polled ERC-20 ${assetAddress} balance on ${network} -> ${balance}/${toEth(balance).toFixed(6)}`)
            } else {
                balance = await fetchAddressBalanceWei(walletAddress, network)
                console.debug(`polled ETH balance on ${network} -> ${balance}/E${toEth(balance).toFixed(6)}`)
            }

            // trickier. we expect that we will always be able to watch the deposit, but we may wake up with some large amount sent
            let amountDeposited = BigNumber.from(0)

            if (balance.gt(0)) {
                if (notifyOnExistingBalance) {
                    if (balance.gt(minDepositThresholdWei)) {
                        amountDeposited = balance
                    } else {
                        console.debug(`balance ${toEth(balance).toFixed(6)} is less than threshold ${toEth(minDepositThresholdWei).toFixed(6)}`)
                    }
                } else {
                    if (balance.gt(previousBalance)) {
                        amountDeposited = balance.sub(previousBalance)
                    }
                }
            }

            if (amountDeposited.gt(0)) {
                console.debug(`detected deposit of ${toEth(amountDeposited).toFixed(6)} ${assetAddress ? assetAddress : 'ETH'}`)
                analytics.track('receivedDeposit', {
                    network: network,
                    amountDeposited: toEth(amountDeposited),
                })

                setDeposit((prevDeposit) => ({
                    ...prevDeposit,
                    amount: amountDeposited,
                }))
                clearInterval(interval)
            }
        }

        _poll()

        const interval = setInterval(_poll, ETH_DEPOSIT_POLL_INTERVAL)
        return () => {
            clearInterval(interval)
        }
    }, [previousBalance, walletAddress])

    return deposit
}

export const useETHDepositTracker = (walletAddress: string, network: Network, minDepositThresholdWei: BigNumber, notifyOnExistingBalance: boolean) => {
    return _depositTracker(walletAddress, network, null, null, minDepositThresholdWei, notifyOnExistingBalance)
}

export const useERC20DepositTracker = (
    walletAddress: string,
    network: Network,
    symbol: string,
    assetAddress: string,
    minDepositThresholdWei: BigNumber,
    notifyOnExistingBalance: boolean
) => {
    return _depositTracker(walletAddress, network, symbol, assetAddress, minDepositThresholdWei, notifyOnExistingBalance)
}
