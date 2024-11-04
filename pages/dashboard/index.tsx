import Layout from '@/components/Reusable/Layout'
import { useCallback, useContext, useEffect, useState } from 'react'
import styles from '@/styles/Home.module.css'
import { useRouter } from 'next/router'

import JuniperIcon from '@/public/icons/JuniperIcon'
import RepayIcon from '@/public/icons/RepayIcon'
import PlusIcon from '@/public/icons/PlusIcon'
import { IoMdCash, IoMdMore } from 'react-icons/io'

import CardCarousel from '@/components/Dashboard/CardCarousel'
import { TransactionModal } from '@/components/Modal/TransactionModal'
import RepayModal from '@/components/Modal/RepayModal'
import GetMoneyModal from '@/components/Modal/GetMoneyModal'
import { FundsAvailableSection } from '@/components/Dashboard/FundsAvailable'
import { CreditUsageSection } from '@/components/Dashboard/CreditUsage'
import { TipsSection } from '@/components/Dashboard/Tips'
import RecentTransactions from '@/components/Dashboard/RecentTransactions'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { userContext } from '@/context/user/userContext'
import { CardAccountContext } from '@/context/CardAccounts/CardAccounts'
import { toast } from 'sonner'
import { formatAddress } from '@/libs/util/formatAddress'

import { GET } from '@/libs/request'
import { analytics } from '@/libs/evkv'
import { IS_PRODUCTION } from '@/libs/constants'
import { Crisp } from 'crisp-sdk-web'
import { staticURL } from '@/libs/constants'
import { CardAccount } from '@prisma/client'

enum ModalType {
    Repay = 'repay',
    None = 'none',
    GetMoney = 'get-money',
}

export default function Home() {
    const router = useRouter()
    const { user, smartWalletAddress } = useContext(userContext)
    const { cardAccounts } = useContext(CardAccountContext)
    const [transactionData, setTransactionData] = useState(null)
    const [modalType, setModalType] = useState<ModalType>(ModalType.None)
    const [clickedCardAccount, setClickedCardAccount] = useState<CardAccount>(null)
    const { totalCollateralUSD, totalDebtUSD, maxSpendingPowerUSD } = useContext(creditLineContext)

    useEffect(() => {
        if (!IS_PRODUCTION) {
            GET<any>('/api/ping').then((pong) => {
                console.debug(`pong: ${JSON.stringify(pong)}`)
            })
        }

        Crisp.chat.show()
    }, [user])

    const closeTransactionModal = () => {
        setTransactionData(null)
    }

    const closeModal = useCallback(() => {
        setModalType(ModalType.None)
        setClickedCardAccount(null)
    }, [])

    const onCardClick = useCallback(
        (cardAccount, displayInfo) => {
            analytics.track('dashboardCardCarouselClicked')
            setClickedCardAccount(cardAccount)
            console.log('clickedCardAccount', cardAccount)
            setModalType(ModalType.GetMoney)
        },
        [setClickedCardAccount, setModalType]
    )

    const onGetMoneyClick = useCallback(() => {
        if (!cardAccounts || cardAccounts.length == 0) {
            router.push('/connect')
        } else {
            setModalType(ModalType.GetMoney)
        }
    }, [cardAccounts, router, setModalType])

    return (
        <Layout>
            <div className={styles.container}>
                <img src={staticURL('/public/images/fullLeaf.png')} width={1512} height={450} alt="leaf" className="full-leaf hidden md:block" />
                <img width={200} height={174} src={staticURL('/public/images/rightLeaf.png')} alt="leaf" className="right-leaf md:hidden" />

                <div className="flex items-center mb-2 w-full">
                    <div className="flex items-center justify-start">
                        {' '}
                        {/* Left-aligned */}
                        <JuniperIcon className="h-max mr-auto pl-6 md:pl-0 w-[160px]" />
                    </div>
                    <div className="flex items-center justify-end w-full">
                        {' '}
                        {/* Right-aligned */}
                        <Link
                            className={'text-light text-xs w-max mt-1 ml-auto pr-6 md:pr-0'}
                            href={`https://optimistic.etherscan.io/address/${smartWalletAddress}`}
                            passHref
                            target="_blank">
                            {formatAddress(smartWalletAddress)}
                        </Link>
                    </div>
                </div>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    <FundsAvailableSection />

                    <div className={styles.ctas}>
                        <button // was Link. links can't be disabled :)
                            disabled={true}
                            // href="/dashboard/fund-account"
                            // scroll={false}
                            onClick={(ev) => {
                                analytics.track('dashboardAddETHClicked')
                            }}>
                            <div className={styles.cta}>
                                <span className={styles.prim}>
                                    <PlusIcon />
                                </span>
                                <p>Deposit</p>
                            </div>
                        </button>

                        <button
                            disabled={maxSpendingPowerUSD < 1}
                            onClick={(ev) => {
                                analytics.track('dashboardGetMoneyClicked')
                                onGetMoneyClick()
                            }}>
                            <div className={styles.cta}>
                                <span>
                                    <IoMdCash />
                                </span>
                                <p>Send Money</p>
                            </div>
                        </button>

                        <button
                            disabled={totalDebtUSD == 0}
                            onClick={() => {
                                setModalType(ModalType.Repay)
                                analytics.track('dashboardRepayClicked')
                            }}
                            className={styles.cta}>
                            <span className={styles.prim}>
                                <RepayIcon />
                            </span>
                            <p>Repay</p>
                        </button>

                        <Link
                            href="/dashboard/settings"
                            scroll={false}
                            onClick={(ev) => {
                                analytics.track('dashboardSettingsClicked')
                            }}>
                            <div className={styles.cta}>
                                <span>
                                    <IoMdMore />
                                </span>
                                <p>More</p>
                            </div>
                        </Link>
                    </div>

                    <TipsSection
                        onAddAccountClick={() => {
                            onGetMoneyClick()
                        }}
                    />

                    {totalCollateralUSD > 0 ? <CreditUsageSection /> : null}

                    <RecentTransactions setTransactionData={setTransactionData} />

                    <div className={styles.cards}>
                        <div className="flex items-center justify-between p-4">
                            <h3 className="text-xl spectral text-light">Connected Accounts</h3>
                            <Link href="/connect" scroll={false}>
                                <PlusIcon color="#959893" />
                            </Link>
                        </div>
                        <CardCarousel onClick={onCardClick} />
                    </div>
                </motion.div>
            </div>

            <TransactionModal onClose={closeTransactionModal} data={transactionData} />
            <RepayModal show={modalType === ModalType.Repay} onClose={closeModal} />
            <GetMoneyModal
                cardAccounts={cardAccounts}
                clickedCardAccount={clickedCardAccount}
                show={modalType === ModalType.GetMoney}
                onClose={(res) => {
                    // res is from POST /card-accounts/:id
                    closeModal()

                    if (res?.data?.amountUSD) {
                        const cardAccount = res.data.cardAccount
                        const cardName = cardAccount.name || capitalizeFirstLetter(cardAccount.provider)

                        toast.success(`Sent $${res.data.amountUSD.toFixed(0)} to ${cardName} ${formatAddress(cardAccount.address)}`)
                    } else if (res?.data?.error) {
                        toast.error(res.data.message)
                    }
                }}
            />
        </Layout>
    )
}

function capitalizeFirstLetter(str) {
    if (!str) return str
    return str.charAt(0).toUpperCase() + str.slice(1)
}
