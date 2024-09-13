/* eslint-disable @next/next/no-img-element */
import styles from '@/styles/SetReferredByModal.module.css'
import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { inter } from '@/libs/font'
import { IoMdClose } from 'react-icons/io'
import { AnimatePresence, motion } from 'framer-motion'
import { header, page } from '@/libs/animate'
import ReferredByView from '@/components/Reusable/ReferredByView'

import { analytics } from 'libs/evkv'

export default function SetReferredByModal({ show, onClose }) {
    const [isBrowser, setIsBrowser] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        setIsBrowser(true)
    }, [])

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
                    <h3 className="spectral text-2xl text-dark">Credit Your Referrer</h3>
                </div>
                <div className={styles.content}>
                    <ReferredByView
                        onReferredBySet={(referredBy) => {
                            onClose()
                            analytics.track('referredBySubmitted', {
                                referredBy: referredBy,
                            })
                        }}
                    />
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
