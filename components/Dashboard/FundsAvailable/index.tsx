import React, { useContext, useEffect, useState } from 'react'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { userContext } from '@/context/user/userContext'
import { formatMoney } from '@/libs/util/formatMoney'
import Skeleton from './Skeleton'
import { AssetPricesContext } from '@/context/AssetPrices/AssetPricesContext'
import { toEth } from '@/libs/util/toEth'
import { SessionKeySigner } from '@/libs/zerodev/SessionKeySigner'

export const FundsAvailableSection: React.FC = () => {
    const { smartWalletAddress, sessionKey } = useContext(userContext)
    const { totalCollateralUSD, maxSpendingPowerUSD, totalIdleUSD, isLoading } = useContext(creditLineContext)
    const { ethPriceUSD } = useContext(AssetPricesContext)

    const [formattedCollateral, setFormattedCollateral] = useState<string>('')
    const [formattedMaxSpendingPower, setFormattedMaxSpendingPower] = useState<string>('')
    const [formattedEthForGas, setFormattedEthForGas] = useState<number>(0)

    useEffect(() => {
        setFormattedCollateral(formatMoney(totalCollateralUSD + totalIdleUSD))
        setFormattedMaxSpendingPower(formatMoney(maxSpendingPowerUSD))

        const signer = new SessionKeySigner(smartWalletAddress, sessionKey)
        signer.getBalance().then((balance) => {
            setFormattedEthForGas(toEth(balance))
        })
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
                <p className="text-[#4B5443] text-xs">
                    Ξ {(formattedEthForGas).toFixed(4)} gas available for transactions
                </p>
            </span>
        </>
    )
}
