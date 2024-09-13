import styles from '@/styles/CardDetail.module.css'
import { useCallback, useContext, useEffect, useState, FormEventHandler } from 'react'
import { IoMdClose } from 'react-icons/io'
import { formatMoney } from '@/libs/util/formatMoney'
import { CardAccountContext } from '@/context/CardAccounts/CardAccounts'
import { MoneyInput } from '@/components/Reusable/MoneyInput'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { userContext } from '@/context/user/userContext'
import { log } from '@/libs/util/log'
import { MIN_SEND_THRESHOLD_USD, MIN_RELOAD_THRESHOLD_USD, staticURL } from '@/libs/constants'
import { getCardAccountDisplayInfo } from '@/context/CardAccounts/CardAccounts'
import { CardCard } from '@/components/Dashboard/CardCarousel'
import { POST } from '@/libs/request'

export function GetMoneyView({ cardAccount, afterSubmitCallback }) {
    const [moneyToSend, setMoneyToSend] = useState<number>(0)
    const [isSavingCard, setIsSavingCard] = useState<boolean>(false)
    const { refreshLoanInfo, maxSpendingPowerUSD, availableBorrowsUSD, totalIdleUSD } = useContext(creditLineContext)
    const { isLoading } = useContext(CardAccountContext)
    const { smartWalletAddress, updateSessionSigner } = useContext(userContext)

    const getExplanation = (cardAccount) => {
        const info = getCardAccountDisplayInfo(cardAccount)
        const isBorrowing = Number(moneyToSend) > totalIdleUSD

        const singleLoadExplanation = (
            <div className="mt-4">
                <p>
                    <span className="font-bold">${moneyToSend}</span> will be sent to your <span className="font-bold">{info.name}</span> account.{' '}
                    {isBorrowing ? (
                        <>
                            A 4% fee will be assessed on the amount borrowed (${(Number(moneyToSend) - totalIdleUSD).toFixed(2)} x 4% = $
                            {((Number(moneyToSend) - totalIdleUSD) * 0.04).toFixed(2)}). Borrowed funds are subject to{' '}
                            <a
                                className="underline text-blue-600 hover:text-blue-800 visited:text-purple-600"
                                target="_blank"
                                href="https://app.aave.com/reserve-overview/?underlyingAsset=0x0b2c639c533813f4aa9d7837caf62653d097ff85&marketName=proto_optimism_v3">
                                Aave's interest rates
                            </a>
                            .
                        </>
                    ) : (
                        <>This transaction has no fees.</>
                    )}{' '}
                    {info.isFiat ? 'Funds will arrive in 1-3 business days.' : 'Funds will arrive as native USDC on Optimism in a few minutes.'}
                </p>
            </div>
        )

        if (Number(moneyToSend) < MIN_SEND_THRESHOLD_USD) {
            return <div className="mt-4 text-red-600 text-center">The amount to send must be greater than ${MIN_SEND_THRESHOLD_USD}.</div>
        } else if (moneyToSend > maxSpendingPowerUSD) {
            return (
                <div className="mt-4 text-red-600 text-center">
                    Sending ${moneyToSend} would be more than what's available to you ({formatMoney(maxSpendingPowerUSD)}), and would put your crypto at risk of
                    being sold.
                </div>
            )
        }
        // else if (autoReload) {
        //     if (reloadThreshold <= MIN_RELOAD_THRESHOLD_USD) {
        //         return <div className="mt-4 text-red-600 text-center">The minimum balance to trigger an auto-reload is ${MIN_RELOAD_THRESHOLD_USD}.</div>
        //     } else {
        //         return autoReloadExplanation
        //     }
        // }
        else {
            return singleLoadExplanation
        }
    }

    const onSubmit: FormEventHandler<HTMLFormElement> = useCallback(
        async (ev) => {
            ev.preventDefault()

            if (!moneyToSend) {
                throw new Error('No money to send')
            }

            setIsSavingCard(true)

            // update session keys before enqueueing the transaction
            await updateSessionSigner()

            const res = await POST(`/api/card-accounts/${cardAccount.id}`, { amountUSD: moneyToSend })
            console.log('res', res)

            await refreshLoanInfo(smartWalletAddress)

            afterSubmitCallback && (await afterSubmitCallback(res))

            setIsSavingCard(false)
        },
        [moneyToSend, smartWalletAddress]
    )

    const onClose = async () => {
        afterSubmitCallback && (await afterSubmitCallback(false))
    }

    const displayInfo = getCardAccountDisplayInfo(cardAccount)

    useEffect(() => {
        if (isLoading) return
        if (!cardAccount) return
        if (!maxSpendingPowerUSD) return

        const def = Math.floor(Math.min(maxSpendingPowerUSD / 4, 10))
        setMoneyToSend(def)
    }, [isLoading, maxSpendingPowerUSD])

    return (
        <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
            <div onClick={onClose} className="absolute top-[18px] left-[22px] text-sm hover:text-blue-700">
                <IoMdClose size={20} />
            </div>

            <h3>Send Money</h3>

            <div style={{ maxWidth: 350 }}>
                <CardCard balance="0" cardAccount={cardAccount} onClick={() => {}} />
            </div>

            <div className="ml-16 grid grid-cols-2 gap-x-4 gap-y-0">
                <span>Money available:</span>
                <span>{formatMoney(totalIdleUSD)}</span>
                <span>Money + borrowing:</span>
                <span>{formatMoney(maxSpendingPowerUSD)}</span>
            </div>

            <form onSubmit={onSubmit} className={styles.form}>
                <p className="mt-2">Amount to send:</p>
                <div className={styles.inputGroup}>
                    <span>$</span>
                    <MoneyInput
                        disabled={isSavingCard || isLoading}
                        value={moneyToSend.toFixed(0)}
                        allowCents={false}
                        onChange={(e) => {
                            let v = parseInt(e.target.value)

                            console.log('val', v)
                            setMoneyToSend(v || 0)
                        }}
                    />
                </div>

                {getExplanation(cardAccount)}

                <div className={styles.cta}>
                    <button
                        type="submit"
                        disabled={isSavingCard || isLoading || moneyToSend < MIN_SEND_THRESHOLD_USD || moneyToSend > maxSpendingPowerUSD}
                        className={`btn btn-primary ${isSavingCard ? 'btn-loading' : ''} `}>
                        {isSavingCard ? 'Sending...' : 'Continue'}
                    </button>
                </div>
            </form>
        </motion.div>
    )
}
