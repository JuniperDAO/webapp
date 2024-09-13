import WithdrawModal from '@/components/Modal/WithdrawModal'
import SetReferralCodeModal from '@/components/Modal/SetReferralCodeModal'
import SetReferredByModal from '@/components/Modal/SetReferredByModal'
import Layout from '@/components/Reusable/Layout'
import { userContext } from '@/context/user/userContext'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import styles from '@/styles/Settings.module.css'
import { useRouter } from 'next/router'
import { useContext, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { header, page } from '@/libs/animate'
import { usePrivy } from '@privy-io/react-auth'
import { GET } from '@/libs/request'
import { IoIosCopy, IoIosArrowRoundBack } from 'react-icons/io'
import { toast } from 'sonner'

import { referralURL, staticURL, IS_PRODUCTION } from '@/libs/constants'
import { JuniperUser } from '@prisma/client'
import { redactKey } from '@/libs/util/log'

export default function Settings() {
    const [isWithdrawModalShown, setIsWithdrawModalShown] = useState<boolean>(false)
    const [isReferralCodeModalShown, setIsReferralCodeModalShown] = useState<boolean>(false)
    const [isReferredByModalShown, setIsReferredByModalShown] = useState<boolean>(false)
    const [referralCount, setReferralCount] = useState<number>(0)
    const [referredByReferralCount, setReferredByReferralCount] = useState<number>(0)
    const router = useRouter()
    const { logout, user, setUser, smartWalletAddress, sessionKey } = useContext(userContext)
    const { exportWallet } = usePrivy()
    const { totalCollateralUSD, totalIdleUSD } = useContext(creditLineContext)

    function copySessionKey() {
        navigator.clipboard.writeText(sessionKey)
        toast.success(`Copied "${redactKey(sessionKey)}" to clipboard`)
    }

    useEffect(() => {
        if (user?.referralCode) {
            GET<any>('/api/referrals').then((res) => {
                if (res.status === 200) {
                    setReferralCount(res.data.referralCount)
                }
            })
        }

        if (user?.referredBy) {
            GET<any>(`/api/referrals/${user.referredBy}`).then((res) => {
                if (res.status === 200) {
                    setReferredByReferralCount(res.data?.referralCount)
                }
            })
        }
    }, [user])

    return (
        <Layout>
            <div className={styles.container}>
                <img src={staticURL('/public/images/fullLeaf.png')} width={1512} height={450} alt="leaf" className="full-leaf hidden md:block" />
                <img width={200} height={174} src={staticURL('/public/images/rightLeaf.png')} alt="leaf" className="right-leaf md:hidden" />
                <motion.div initial="initial" animate="animate" exit="exit" variants={header} className={styles.header}>
                    <div className="flex items-center w-full">
                        <IoIosArrowRoundBack className={styles.backIcon} size={32} onClick={() => router.back()} />
                        <span className={'text-light text-xs w-max mt-1 ml-auto pr-6 md:pr-0'}>{user?.email}</span>
                    </div>
                </motion.div>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    <div className={`${styles.setting}`}>
                        <p className={`${styles.clickable} text-lg text-dark spectral`} onClick={exportWallet}>
                            Copy Private Key (Advanced)
                        </p>
                        <p className={`text-sm text-[#959893]`}>Copy the private key for the EOA that owns your smart wallet.</p>
                    </div>

                    {!IS_PRODUCTION && (
                        <div className={`${styles.setting}`}>
                            <p className={`${styles.clickable} text-lg text-dark spectral`} onClick={() => copySessionKey()}>
                                Copy Session Key (developer mode)
                            </p>
                            <p className={`text-sm text-[#959893]`}>Copy the session key for your smart wallet.</p>
                        </div>
                    )}

                    <div onClick={() => open('https://discord.gg/45w5XM6M47', '_blank')} className={`${styles.setting} ${styles.clickable}`}>
                        <p className="text-lg text-dark spectral">Join Discord</p>
                        <p className="text-sm text-[#959893]">Meet the team, discuss crypto, provide feedback.</p>
                    </div>

                    {(totalCollateralUSD > 0 || totalIdleUSD > 0) && (
                        <div
                            className={`${styles.setting} ${styles.clickable}`}
                            onClick={() => {
                                setIsWithdrawModalShown(true)
                            }}>
                            <p className="text-lg text-dark spectral">Withdraw Your Assets</p>
                            <p className="text-sm text-[#959893]">Assets can be withdrawn if your balance is fully repaid.</p>
                        </div>
                    )}
                    <button className={`${styles.setting} ${styles.clickable}`} onClick={logout}>
                        <p className="text-lg text-dark spectral">Logout</p>
                    </button>
                </motion.div>
            </div>

            <SetReferralCodeModal show={isReferralCodeModalShown} onClose={() => setIsReferralCodeModalShown(false)} />

            <SetReferredByModal show={isReferredByModalShown} onClose={() => setIsReferredByModalShown(false)} />

            <WithdrawModal show={isWithdrawModalShown} onClose={() => setIsWithdrawModalShown(false)} />
        </Layout>
    )
}
