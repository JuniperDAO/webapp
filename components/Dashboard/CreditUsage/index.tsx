import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import styles from '@/styles/Home.module.css'
import { useContext, useEffect, useState } from 'react'
import Skeleton from './Skeleton'
import { RECOMMENDED_LOAN_LTV } from '@/libs/constants'
import { staticURL } from '@/libs/constants'

/**
 * Normalization was too confusing for users
 */
export const CreditUsageSection: React.FC = () => {
    const [rawPercent, setRawPercent] = useState<number>(0)
    const [healthTier, setHealthTier] = useState<HealthTier>(healthTiers[0])

    const { totalCollateralUSD, totalDebtUSD, ltvBips, isLoading } = useContext(creditLineContext)

    useEffect(() => {
        // if they have no collateral, bail
        if (!totalCollateralUSD) return

        const rawPercentage = (totalDebtUSD / totalCollateralUSD) * 100

        // if < 10% show 1 decimal place, otherwise round
        const formattedRaw = rawPercent < 10 ? parseFloat(rawPercentage.toFixed(1)) : Math.round(rawPercentage)

        const healthTier = getHealthTier(rawPercentage)

        setHealthTier(healthTier)
        setRawPercent(formattedRaw)
    }, [totalCollateralUSD, totalDebtUSD])

    if (isLoading) return <Skeleton />

    return (
        <div className={styles.usage}>
            <div className={styles.stats}>
                <CreditUsageChart
                    percentage={rawPercent}
                    // rotation is weird otherwise
                    maxLTVPercent={100}
                    colorClass={healthTier.colorClass}
                />

                <p className="spectral text-dark">{rawPercent}%</p>
            </div>
            <p className="spectral text-2xl mt-7 text-center text-dark">{healthTier.label}</p>
            <div className="flex justify-center items-center">
                <p className="mt-2 max-w-sm mx-auto text-light leading-tight">{healthTier.description}</p>
            </div>
        </div>
    )
}

function CreditUsageChart({ percentage, maxLTVPercent, colorClass }) {
    const rotate = (percentage / maxLTVPercent) * 180 + 'deg'

    return (
        <div className={styles.chart}>
            <img src={staticURL('/images/creditChart.png')} width={250} height={135} alt="Chart" />
            <div style={{ rotate }} className={`${styles.circle} ${styles[colorClass]}`} />
        </div>
    )
}

const getHealthTier = (rawPercent: number): HealthTier => {
    return healthTiers.find((tier) => {
        return rawPercent <= tier.maxPercent
    })
}

type HealthTier = {
    colorClass: string
    label: string
    description: string
    maxPercent: number
}

const healthTiers: HealthTier[] = [
    {
        colorClass: 'green',
        label: 'Paid In Full',
        description: 'You have not used any of your crypto.',
        maxPercent: 0.00001,
    },
    {
        colorClass: 'green',
        label: 'Get Spending!',
        description: 'You are barely using your crypto.',
        maxPercent: 10,
    },
    {
        colorClass: 'green',
        label: 'Looking Good!',
        description: 'Your crypto usage is healthy.',
        maxPercent: RECOMMENDED_LOAN_LTV,
    },
    {
        colorClass: 'yellow',
        label: 'Consider Repayment',
        description: 'You are using a significant portion of your crypto.',
        maxPercent: 71,
    },
    {
        colorClass: 'orange',
        label: 'Repay Now',
        description: 'Repay or deposit to avoid having your crypto sold.',
        maxPercent: 81,
    },
    {
        colorClass: 'red',
        label: 'Danger!',
        description: 'Repay or deposit as soon as possible.',
        maxPercent: 101,
    },
]
