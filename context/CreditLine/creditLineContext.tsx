'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { CreditLineProps } from './types'
import { userContext } from '../user/userContext'
import { fetchCreditLineInfoForUI } from './fetchCreditLineInfoForUI'
import { getERC20Balance, getAllStableBalances } from '@/libs/util/getERC20Balance'
import { Network } from '@/libs/network/types'
import { toEth } from '@/libs/util/toEth'

const defaultCreditLineProps: CreditLineProps = {
    totalCollateralUSD: 0,
    totalDebtUSD: 0,
    totalIdleUSD: 0,
    maxSpendingPowerUSD: 0,
    availableBorrowsUSD: 0,
    liquidationBips: 10000,
    ltvBips: 70,
    isLoading: true,
    error: '',
    refreshLoanInfo: async (address: string) => {},
    cancelRefreshLoanInfo: () => {},
}

export const creditLineContext = createContext<CreditLineProps>(defaultCreditLineProps)

const REFRESH_INTERVAL_S = 10

function CreditLineProvider({ children }) {
    const [creditLineProps, setCreditLineProps] = useState<CreditLineProps>(defaultCreditLineProps)
    const [timer, setTimer] = useState(null)

    const { smartWalletAddress } = useContext(userContext)

    const refreshLoanInfo = async (smartWalletAddress: string) => {
        // TODO - add error handling
        const info = await fetchCreditLineInfoForUI(smartWalletAddress)
        const scwStablesWei = await getAllStableBalances(smartWalletAddress, Network.optimism)

        const { totalCollateralUSD, totalDebtUSD, ltvBips } = info
        const _maxSpendingPower = Math.max(totalCollateralUSD * (ltvBips / 10000) - totalDebtUSD + toEth(scwStablesWei), 0)
        // console.log(`maxSpendingPower: ${totalCollateralUSD} ${totalDebtUSD} ${ltvBips} ${scwUSDC} = ${_maxSpendingPower}`)

        setCreditLineProps((props) => ({
            ...props,
            ...info,
            totalIdleUSD: toEth(scwStablesWei),
            maxSpendingPowerUSD: _maxSpendingPower,
            isLoading: false,
        }))
    }

    useEffect(() => {
        if (!smartWalletAddress) return

        if (!timer) {
            setTimer(
                setInterval(async () => {
                    await refreshLoanInfo(smartWalletAddress)
                }, REFRESH_INTERVAL_S * 1000)
            )
        }

        refreshLoanInfo(smartWalletAddress)
    }, [smartWalletAddress])

    const contextValue = {
        ...creditLineProps,
        refreshLoanInfo,
        cancelRefresh: () => {
            clearInterval(timer)
            setTimer(null)
        },
    }

    return <creditLineContext.Provider value={contextValue}>{children}</creditLineContext.Provider>
}

export default CreditLineProvider
