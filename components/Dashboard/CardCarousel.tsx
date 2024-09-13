/* eslint-disable @next/next/no-img-element */
import React, { useContext, useEffect, useState } from 'react'
import styles from '@/styles/Cards.module.css'

import 'swiper/css'
import 'swiper/css/free-mode'

import { Swiper, SwiperSlide } from 'swiper/react'
import { FreeMode } from 'swiper/modules'

// Import Swiper styles
import 'swiper/css'
import 'swiper/css/free-mode'
import { CardAccountContext, getCardAccountDisplayInfo } from '@/context/CardAccounts/CardAccounts'
import { formatAddress } from '@/libs/util/formatAddress'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { IoIosAdd } from 'react-icons/io'
import { analytics } from '@/libs/evkv'

export default function CardCarousel({ onClick }) {
    const { isLoading, cardAccounts, balances } = useContext(CardAccountContext)

    if (isLoading) return <Skeleton />
    if (cardAccounts.length === 0) return <CreateCardCTA />

    return (
        <Swiper slidesPerView="auto" spaceBetween={10} freeMode={true} modules={[FreeMode]} className="cardCarousel">
            {React.Children.toArray(
                cardAccounts.map((cardAccount) => {
                    return (
                        <SwiperSlide>
                            <CardCard onClick={onClick} cardAccount={cardAccount} balance={balances.get(cardAccount.id)} backgroundColor="#fff" />
                        </SwiperSlide>
                    )
                })
            )}
        </Swiper>
    )
}

export function CardCard({ onClick, cardAccount, balance, backgroundColor = 'transparent' }) {
    const router = useRouter()
    const displayInfo = getCardAccountDisplayInfo(cardAccount)

    // console.log('displayInfo', cardAccount, displayInfo)

    return (
        <div
            className={styles.card}
            onClick={(ev) => {
                ev.stopPropagation()
                return onClick(cardAccount)
            }}
            style={{ cursor: 'pointer', backgroundColor }}>
            <div style={{ position: 'relative' }}>
                <img width={307} height={192} src={displayInfo.image} alt={displayInfo.name} />

                {cardAccount.provider !== 'coinbase' && (
                    <div style={{ position: 'absolute', bottom: '10%', left: '8%', textAlign: 'left' }}>
                        <p className={`text-sm text-bold ${styles.logo}`}>{displayInfo.name}</p>
                    </div>
                )}

                <div style={{ position: 'absolute', bottom: '25%', right: '8%', textAlign: 'left' }}>
                    <Link
                        href={`https://optimistic.etherscan.io/address/${displayInfo.address}`}
                        passHref
                        target="_blank"
                        className={`text-xs font-mono ${styles.emboss}`}
                        onClick={(e) => e.stopPropagation()}>
                        {formatAddress(displayInfo.address, 8, 6)}
                    </Link>
                </div>
            </div>
        </div>
    )
}

function CreateCardCTA() {
    const router = useRouter()
    return (
        <div className={styles.placeholderCard}>
            <p className="text-sm text-light mb-2">Connect your wallet or exchange to send money.</p>
            <Link href="/connect" scroll={false}>
                <div className={`${styles.cardWithBorder} btn btn-primary bg-[#fffbf3] text-center`}>
                    <IoIosAdd className="text-[#e0d4b7] " size={80} />
                    <p className="btn btn-primary">Add Account</p>
                </div>
            </Link>
        </div>
    )
}

function Skeleton() {
    return (
        <>
            <div className="w-full px-3 pb-3 flex-col space-y-4 items-center justify-between cursor-pointer animate-pulse">
                <div className="bg-stone-100 h-[200px] w-full" />
                <div className="bg-stone-200 h-3 w-2/3" />
                <div className="bg-stone-200 h-3 w-1/3" />
            </div>
        </>
    )
}
