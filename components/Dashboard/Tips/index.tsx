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

    // Make your first deposit tip
    if (totalCollateralUSD === 0) {
        analytics.track('firstDepositTipShown', { totalCollateralUSD })
        return (
            <div className={styles.tips}>
                <p className="spectral text-2xl text-center text-dark">Make a deposit</p>
                <div className="flex justify-center items-center">
                    <p className="mt-2 max-w-sm mx-auto text-light leading-tight">
                        Add crypto assets to your wallet to earn staking yield and send money to your accounts.
                    </p>
                </div>
                <div className="flex justify-center items-center mt-4">
                    <button
                        onClick={() => {
                            analytics.track('tipsDepositClicked')
                            router.push('/dashboard/fund-account')
                        }}
                        className="btn btn-primary">
                        Deposit
                    </button>
                </div>
            </div>
        )
    }

    // Connect your account(s) tip
    if (cardAccounts.length === 0) {
        analytics.track('cardAccountsTipShown')
        return (
            <div className={styles.tips}>
                <p className="spectral text-2xl text-center text-dark">Connect Your Accounts</p>
                <div className="flex justify-center items-center">
                    <p className="mt-2 max-w-sm mx-auto text-light leading-tight">Connect your wallet or exchange account(s) to send money.</p>
                </div>
                <div className="flex justify-center items-center mt-4">
                    <button
                        onClick={() => {
                            analytics.track('tipsAddAccountClicked')
                            onAddAccountClick()
                        }}
                        className="btn btn-primary">
                        Add Account
                    </button>
                </div>
            </div>
        )
    }

    // Set your referred by tip
    if (totalCollateralUSD > 0 && !user?.referredBy && user?.createdAt) {
        const createdAtDate = new Date(user.createdAt)
        const oneWeekAgo = new Date()
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

        if (createdAtDate > oneWeekAgo) {
            analytics.track('referredByTipShown', { createdAtDate })
            return (
                <div className={styles.tips}>
                    <ReferredByView />
                </div>
            )
        }
    }

    return null
}
