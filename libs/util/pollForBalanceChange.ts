import { Signer, BigNumber } from 'ethers'
import { getERC20Balance } from './getERC20Balance'
import { Network } from '../network/types'

export type PollForBalanceChangeArgs = {
    signer: Signer
    timeoutAfter?: number
    interval?: number
    overrideOriginalBalance?: BigNumber
}

export type PollForERC20BalanceChangeArgs = PollForBalanceChangeArgs & {
    tokenAddress: string
}

export type PollForBalanceChangeResult = {
    didTimeOut: boolean
    currentBalance?: BigNumber
}

export const pollForBalanceChange = async ({
    timeoutAfter = 1000 * 60 * 5, // 5 minutes
    interval = 5000,
    signer,
    overrideOriginalBalance,
}: PollForBalanceChangeArgs): Promise<PollForBalanceChangeResult> => {
    const originalBalance = overrideOriginalBalance !== undefined ? overrideOriginalBalance : await signer.getBalance()
    const walletAddress = await signer.getAddress()

    const timeOutPromise = timeOut(timeoutAfter)
    const pollingPromise = getNativePollingPromise(signer, originalBalance, interval)

    // return whichever one finishes first
    // the timeout or the balance change
    console.log(`waiting on balance .gt(${originalBalance}) on ${walletAddress} (timeout: ${timeoutAfter}}`)
    const result = await Promise.race<PollForBalanceChangeResult>([timeOutPromise, pollingPromise])

    return result
}

// NOTE: this polls for a balance change
// in either direction (increase or decrease)
export const pollForERC20BalanceChange = async ({
    timeoutAfter = 1000 * 60 * 2, // 2 minutes
    interval = 3000,
    signer,
    overrideOriginalBalance,
    tokenAddress,
}: PollForERC20BalanceChangeArgs): Promise<PollForBalanceChangeResult> => {
    const walletAddress = await signer.getAddress()
    const originalBalance = overrideOriginalBalance || (await getERC20Balance(walletAddress, Network.optimism, tokenAddress))

    const timeOutPromise = timeOut(timeoutAfter)
    const pollingPromise = getERC20PollingPromise(walletAddress, originalBalance, interval, tokenAddress)

    // return whichever one finishes first
    // the timeout or the balance change
    const result = await Promise.race<PollForBalanceChangeResult>([timeOutPromise, pollingPromise])

    return result
}

const timeOut = (timeMs = 100): Promise<PollForBalanceChangeResult> => new Promise((resolve) => setTimeout(() => resolve({ didTimeOut: true }), timeMs))

const getNativePollingPromise = (signer: Signer, originalBalance: BigNumber, interval: number): Promise<PollForBalanceChangeResult> => {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            const currentBalance = await signer.getBalance()
            // console.log('poll: ', currentBalance)
            if (!currentBalance.eq(originalBalance)) {
                resolve({ currentBalance, didTimeOut: false })
            } else {
                setTimeout(poll, interval)
            }
        }
        poll()
    })
}

const getERC20PollingPromise = (address: string, originalBalance: BigNumber, interval: number, tokenAddress: string): Promise<PollForBalanceChangeResult> => {
    return new Promise((resolve, reject) => {
        const poll = async () => {
            const currentBalance = await getERC20Balance(address, Network.optimism, tokenAddress)

            // console.log('poll: ', currentBalance)

            if (!currentBalance.eq(originalBalance)) {
                resolve({ currentBalance, didTimeOut: false })
            } else {
                setTimeout(poll, interval)
            }
        }
        poll()
    })
}
