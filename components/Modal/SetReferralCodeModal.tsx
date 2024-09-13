/* eslint-disable @next/next/no-img-element */
import styles from '@/styles/SetReferralCodeModal.module.css'
import { useCallback, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { inter } from '@/libs/font'
import { toast } from 'sonner'
import { IoMdClose } from 'react-icons/io'
import { PUT } from '@/libs/request'
import { userContext } from '@/context/user/userContext'
import { AnimatePresence, motion } from 'framer-motion'
import { header, page } from '@/libs/animate'

import { analytics } from 'libs/evkv'

export default function SetReferralCodeModal({ show, onClose }) {
    const [isBrowser, setIsBrowser] = useState(false)
    const [inputCode, setInputCode] = useState('')
    const [inputCodeError, setInputCodeError] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const { user, setUser } = useContext(userContext)

    useEffect(() => {
        setIsBrowser(true)
    }, [])

    const handleSubmit = useCallback(async () => {
        if (!inputCode?.length) return

        setIsSubmitting(true)
        setInputCodeError('')

        try {
            const res = await PUT(`/api/referrals`, { referralCode: inputCode })
            if (res.status == 200) {
                analytics.track('setReferralCode', { referralCode: inputCode })

                setUser({
                    ...user,
                    referralCode: inputCode,
                })

                toast.success(`"${inputCode}" is set as your referral code.`)

                onClose()
            } else {
                setInputCodeError(res.data?.message || 'An error occurred setting your referral code.')
            }
        } catch (error) {
            toast.error(error.message, {
                position: 'top-center',
            })
        }

        setIsSubmitting(false)
    }, [inputCode, isSubmitting, inputCodeError, isBrowser])

    const handleKeyDown = (ev) => {
        if (ev.key === 'Enter') {
            ev.preventDefault()
            handleSubmit()
        }
    }

    const handleInputChange = (ev) => {
        setInputCode(ev.target.value)
    }

    const modalContent = show ? (
        <AnimatePresence mode="wait">
            <motion.div
                initial="initial"
                animate="animate"
                exit="exit"
                key="overlay"
                variants={header}
                style={{ zIndex: 1000 }}
                onClick={() => {
                    if (isSubmitting) return
                    onClose()
                }}
                className="overlay"
            />

            <motion.div
                initial="initial"
                animate="animate"
                exit="exit"
                key="modal"
                layoutId="modal"
                variants={page}
                className={`modal ${styles.container} ${inter.className}`}
                style={{ zIndex: 1001 }}>
                <div className={styles.header}>
                    <IoMdClose
                        onClick={() => {
                            if (isSubmitting) return
                            onClose()
                        }}
                        className={styles.backIcon}
                        size={20}
                    />
                    <h3 className="spectral text-2xl text-dark">Set Your Referral Code</h3>
                </div>
                <div className={styles.content}>
                    <p className="mt-4 text-sm max-w-sm mx-auto text-dark">
                        Your referral code allows other users to credit you for their deposit, and lets you to participate in contests.
                    </p>
                    {/* wow - if you use the phrase "username" here, the browser may make the input below a password autofill */}
                    <p className={`mt-4 text-sm max-w-sm mx-auto text-dark ${inputCodeError ? 'text-red-500' : ''}`}>
                        {inputCodeError
                            ? inputCodeError
                            : "Once your referral code is set, it can't be changed. We suggest using whatever people normally call you online. Only use letters A-Z, numbers, and underscores (_)."}
                    </p>

                    <input
                        name="referralCode"
                        autoComplete="off"
                        className={`${styles.input} ${false ? 'error-msg' : ''}`}
                        disabled={isSubmitting}
                        type="text"
                        placeholder="Your desired referral code"
                        value={inputCode}
                        onKeyDown={handleKeyDown}
                        onChange={handleInputChange}
                    />
                    <p className="error-msg text-start">{false}</p>

                    <div className="flex flex-col gap-3 mt-4 md:mt-6">
                        <button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !inputCode?.length}
                            className={`btn btn-primary ${isSubmitting ? 'btn-loading' : ''} `}>
                            {isSubmitting ? 'Setting...' : 'Set Referral Code'}
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    ) : null

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
