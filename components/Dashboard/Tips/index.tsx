import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { userContext } from '@/context/user/userContext'
import styles from '@/styles/Home.module.css'
import { useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { analytics } from '@/libs/evkv'
import { toast } from 'sonner'
import ReferredByView from '@/components/Reusable/ReferredByView'
import { staticURL } from '@/libs/constants'
import { Crisp } from 'crisp-sdk-web'
import Link from 'next/link'
import { CardAccountContext } from '@/context/CardAccounts/CardAccounts'

type TipsSectionProps = {
    onAddAccountClick: () => void
}

export const TipsSection: React.FC<TipsSectionProps> = ({ onAddAccountClick }) => {
    const router = useRouter()
    const { totalCollateralUSD, isLoading: isLoading0 } = useContext(creditLineContext)
    const { isLoading: isLoading1, cardAccounts } = useContext(CardAccountContext)
    const { user } = useContext(userContext)

    if (isLoading0 || isLoading1) return null

    if (totalCollateralUSD > 1) {
        return (
            <div className={styles.tips}>
                <p className="spectral text-2xl text-center text-dark">Withdraw Your Assets</p>
                <div className="flex justify-center items-center">
                    <p className="mt-2 max-w-sm mx-auto text-light leading-tight">
                        Effective Q4 2024, Juniper is in maintenance mode. You can withdraw your funds by clicking the button below.
                    </p>
                </div>
                <div className="flex justify-center items-center mt-4">
                    <button
                        onClick={() => {
                            router.push('/dashboard/withdraw')
                        }}
                        className="btn btn-primary">
                            Withdraw
                    </button>
                </div>
            </div>
        )
    } else {
        return (
            <div className={styles.tips}>
                <p className="spectral text-2xl text-center text-dark">Juniper is in maintenance mode.</p>
                <div className="flex justify-center items-center">
                    <p className="mt-2 max-w-sm mx-auto text-light leading-tight">
                        Effective Q4 2024, Juniper is in maintenance mode. We appreciate your support for the past two years! Stay tuned for our next project.
                    </p>
                </div>
            </div>
        )
    }

    return null
}
