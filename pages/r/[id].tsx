import styles from '@/styles/FundAccount.module.css'
import Layout from '@/components/Reusable/Layout'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { analytics } from '@/libs/evkv'
import { usePrivy } from '@privy-io/react-auth'

import { GET } from '@/libs/request'
import { staticURL } from '@/libs/constants'
import { HelpdeskLink } from '@/components/Reusable/HelpdeskLink'

export default function Refer() {
    // e.g. http://localhost:3000/r/5f9e3e3e3e3e3e3e3e3e3e3e
    const router = useRouter()
    const { ready, authenticated } = usePrivy()
    const [referrer, setReferrer] = useState('')
    const [referralError, setReferralError] = useState('')
    const [nextURL, setNextURL] = useState('')
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!router) return
        if (!ready) return

        const { id } = router.query
        if (id) {
            setReferrer(id as string)
        }

        setNextURL(authenticated ? '/dashboard' : '/signin')

        if (id) {
            GET(`/api/referrals/${id}`).then((res) => {
                if (res.status !== 200) {
                    const { message } = res.data as any
                    setReferralError(message || `An error occurred while processing your referral for ${id}. Please try again later.`)
                    console.error('err', res)
                } else {
                    setIsLoading(false)
                }
            })
        }
    }, [router, ready, authenticated])

    return (
        <Layout>
            <div className={styles.container}>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    <img className="m-0" src={staticURL('/public/images/juniper.png')} />

                    {referralError && <p className="text-sm max-w-sm mx-auto text-dark">{referralError}</p>}

                    {!referralError && !isLoading && (
                        <>
                            <p className="text-sm max-w-sm mx-auto text-dark">Welcome! You were referred to Juniper by</p>
                            <h3>{referrer}</h3>
                            <p className="text-sm max-w-sm mx-auto text-dark">Once your referral code is set, you can't change it.</p>
                            <button
                                className="mt-4 btn btn-primary"
                                onClick={(ev) => {
                                    localStorage.setItem('referrer', referrer)
                                    analytics.track('setReferrer', { referrer })
                                    router.replace(nextURL)
                                }}>
                                Confirm
                            </button>
                            <button
                                className="btn btn-secondary mt-2"
                                onClick={(ev) => {
                                    localStorage.removeItem('referrer')
                                    router.replace(nextURL)
                                }}>
                                Cancel
                            </button>
                            <div className="mt-2">
                                <HelpdeskLink slug="referral-program-conditions-e9lwsa" text="Juniper Referral Terms" />
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </Layout>
    )
}
