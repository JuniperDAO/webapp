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
import WithdrawModal from '@/components/Modal/WithdrawModal'
import { SessionKeySigner } from '@/libs/zerodev/SessionKeySigner'
import { toEth } from '@/libs/util/toEth'

type TipsSectionProps = {
    onAddAccountClick: () => void
}

export const TipsSection: React.FC<TipsSectionProps> = ({ onAddAccountClick }) => {
    const router = useRouter()
    const { totalCollateralUSD, isLoading: isLoading0 } = useContext(creditLineContext)
    const [formattedEthForGas, setFormattedEthForGas] = useState<number>(0)
    const { isLoading: isLoading1, cardAccounts } = useContext(CardAccountContext)
    const { user, smartWalletAddress, sessionKey } = useContext(userContext)
    const [isWithdrawModalShown, setIsWithdrawModalShown] = useState<boolean>(false)

    // if (isLoading0 || isLoading1) return null

    useEffect(() => {
        const signer = new SessionKeySigner(smartWalletAddress, sessionKey)
        signer.getBalance().then((balance) => {
            setFormattedEthForGas(toEth(balance))
        })
    }, [])

    if (totalCollateralUSD > 0 || formattedEthForGas > 0) {
        return (
            <div className={styles.tips}>
                <p className="spectral text-2xl text-center text-dark">Juniper is in maintenance mode</p>
                <div className="flex justify-center items-center">
                    <p className="mt-2 max-w-sm mx-auto text-light leading-tight">
                        You can withdraw your funds, but
                        if you have any debt, you'll need to repay it first. Gas costs are no longer sponsored; you'll need to send in some small amount of raw ETH (probably less than 0.01) to your smart wallet to cover gas fees.
                    </p>
                </div>
                <div className="flex justify-center items-center mt-4">
                    <button
                        onClick={() => {
                            setIsWithdrawModalShown(true)
                        }}
                        className="btn btn-primary">
                            Withdraw
                    </button>
                    <WithdrawModal show={isWithdrawModalShown} onClose={() => setIsWithdrawModalShown(false)} />
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
