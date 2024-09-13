import React, { useContext, useEffect, useState } from 'react'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { formatMoney } from '@/libs/util/formatMoney'
import Skeleton from './Skeleton'
import { AssetPricesContext } from '@/context/AssetPrices/AssetPricesContext'

export const FundsAvailableSection: React.FC = () => {
    const { totalCollateralUSD, maxSpendingPowerUSD, totalIdleUSD, isLoading } = useContext(creditLineContext)
    const { ethPriceUSD } = useContext(AssetPricesContext)

    const [formattedCollateral, setFormattedCollateral] = useState<string>('')
    const [formattedMaxSpendingPower, setFormattedMaxSpendingPower] = useState<string>('')

    useEffect(() => {
        setFormattedCollateral(formatMoney(totalCollateralUSD + totalIdleUSD))
        setFormattedMaxSpendingPower(formatMoney(maxSpendingPowerUSD))
    }, [totalCollateralUSD, totalIdleUSD, maxSpendingPowerUSD])

    if (isLoading) return <Skeleton />

    return (
        <>
            <p className="text-xs text-[#a5a798]">Money Available / Net Worth</p>
            <span className="flex gap-1 items-end">
                <h3 className="text-[#4B5443] text-3xl spectral">{formattedMaxSpendingPower}</h3>
                <p className="text-[#a5a798] text-xl spectral"> / {formattedCollateral}</p>
            </span>
            <span className="flex gap-1">
                <p className="text-[#4B5443] text-xs">Ξ {(maxSpendingPowerUSD / ethPriceUSD).toFixed(2)}</p>
                <p className="text-[#a5a798] text-xs">/ Ξ{(totalCollateralUSD / ethPriceUSD).toFixed(2)}</p>
            </span>
            {/* <span className="flex gap-1">
                <p className="text-[#4B5443] text-xs">ETH Ξ{(totalDebtUSD / ethPriceUSD).toFixed(2)}</p>
                <p className="text-[#a5a798] text-xs">/ Ξ{(totalCollateralUSD / ethPriceUSD).toFixed(2)}</p>
            </span> */}
        </>
    )
}
