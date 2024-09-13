/* eslint-disable @next/next/no-img-element */
import styles from '@/styles/AddCardModal.module.css'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import ReactDOM from 'react-dom'
import { GetMoneyView } from '../Dashboard/SpendingPower/GetMoneyView'
import { formatAddress } from '@/libs/util/formatAddress'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'
import { IoMdClose } from 'react-icons/io'
import { staticURL } from '@/libs/constants'
import { analytics } from '@/libs/evkv'

export default function GetMoneyModal({ onClose, show, cardAccounts, clickedCardAccount }) {
    const [isBrowser, setIsBrowser] = useState(false)
    const [selectedCardAccount, setSelectedCardAccount] = useState(clickedCardAccount)
    const router = useRouter()

    useEffect(() => {
        setIsBrowser(true)
    }, [])

    const getMoneyViewClosed = (res) => {
        setSelectedCardAccount(null)
        onClose(res)
    }

    let modalContent = null
    if (show) {
        modalContent = (
            <>
                <div onClick={onClose} className="overlay" />
                <div className={`modal ${styles.container}`} style={{ padding: 0 }}>
                    {(selectedCardAccount || clickedCardAccount) && (
                        <GetMoneyView cardAccount={selectedCardAccount || clickedCardAccount} afterSubmitCallback={getMoneyViewClosed} />
                    )}

                    {!clickedCardAccount && !selectedCardAccount && (
                        <>
                            <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={'mb-4 ' + styles.content}>
                                <div onClick={getMoneyViewClosed} className="absolute top-[18px] left-[22px] text-sm hover:text-blue-700">
                                    <IoMdClose size={20} />
                                </div>

                                <h3 className="mt-4">{cardAccounts.length ? 'Send Money Where?' : 'Add an Account'}</h3>

                                <div className="mt-2 mb-3">
                                    {cardAccounts.length
                                        ? 'On which account would you like to receive your money?'
                                        : 'Connect an account to receive your money.'}
                                </div>

                                {cardAccounts.map((cardAccount, index) => (
                                    <button
                                        key={cardAccount.id}
                                        className={'mb-2 btn ' + (index === 0 ? ' btn-primary' : ' btn-secondary')}
                                        // className={'mb-2 btn btn-secondary'}
                                        onClick={() => {
                                            analytics.track('getMoneyViewClickedAccount', { cardAccount: cardAccount })
                                            setSelectedCardAccount(cardAccount)
                                        }}>
                                        {cardAccount.provider === 'bridge' && (
                                            <>
                                                {cardAccount.bankName || 'Bank Account'}
                                                {cardAccount.last4 && ' - ' + cardAccount.last4}
                                            </>
                                        )}
                                        {cardAccount.provider === 'coinbase' && (
                                            <>
                                                Coinbase
                                                {cardAccount.address && <p className="text-sm font-mono">{' ' + formatAddress(cardAccount.address)}</p>}
                                            </>
                                        )}
                                        {cardAccount.provider !== 'coinbase' && cardAccount.provider !== 'bridge' && (
                                            <>
                                                {cardAccount.name || cardAccount.provider.charAt(0).toUpperCase() + cardAccount.provider.slice(1).toLowerCase()}
                                                {<p className="text-sm font-mono">{' ' + formatAddress(cardAccount.address)}</p>}
                                            </>
                                        )}
                                    </button>
                                ))}

                                {cardAccounts?.length && <div className="mt-2 mb-2 text-center">Account not listed?</div>}

                                <button
                                    className={'mb-2 btn btn-secondary'}
                                    onClick={() => {
                                        analytics.track('getMoneyViewClickedAddAccount')
                                        router.push('/connect')
                                    }}>
                                    Add New Account
                                </button>
                            </motion.div>
                        </>
                    )}
                </div>
            </>
        )
    }

    if (isBrowser) {
        return ReactDOM.createPortal(
            modalContent,
            // @ts-ignore
            document.getElementById('modal-root')
        )
    } else {
        return null
    }
}
