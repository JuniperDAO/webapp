/* eslint-disable @next/next/no-img-element */
import styles from '@/styles/TransactionModal.module.css'
import { useCallback, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { inter } from '@/libs/font'
import { IoMdClose, IoIosArrowRoundForward } from 'react-icons/io'
import { typeToCopy } from '@/components/Reusable/Transaction'
import { AssetPricesContext } from '@/context/AssetPrices/AssetPricesContext'
import { formatFullDate } from '@/libs/util/time'
import { JuniperTransaction, JuniperTransactionType, signForTransactionType } from '@/libs/transactionHistory/types'
import { formatMoney } from '@/libs/util/formatMoney'

import Link from 'next/link'

type TransactionModalProps = {
    onClose: () => void
    data: JuniperTransaction
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ onClose, data }) => {
    const [isBrowser, setIsBrowser] = useState(false)

    const { getPriceByAssetName } = useContext(AssetPricesContext)
    const sign = signForTransactionType(data?.type)

    useEffect(() => {
        setIsBrowser(true)
    }, [])

    const getUSDAmountStr = useCallback(() => {
        const amountUSD =
            data.type === JuniperTransactionType.Deposit || data.type === JuniperTransactionType.Withdraw
                ? data.amount * getPriceByAssetName(data.currency)
                : data.amount

        return `${sign}${formatMoney(amountUSD)}`
    }, [getPriceByAssetName, data])

    const modalContent = !!data ? (
        <>
            <div onClick={onClose} className="overlay" />

            <div className={`modal ${styles.container} ${inter.className}`}>
                <div className={styles.header}>
                    <IoMdClose onClick={onClose} className={styles.backIcon} size={20} />
                    <h3 className="spectral text-2xl text-dark">Transaction Details</h3>
                </div>
                <div className={styles.content}>
                    <div className={`text-3xl spectral text-dark ml-2 ${data.transactionHash.startsWith('intent') && 'italic'}`}>
                        {data.amount ? getUSDAmountStr() : 'Pending'}
                    </div>

                    {!data.transactionHash.startsWith('intent') && (
                        <div className={styles.row}>
                            <p className="text-light">Currency</p>
                            <p className="flex items-center gap-2">
                                {sign}
                                {data.amount.toFixed(4)} {data.currency}
                            </p>
                        </div>
                    )}

                    <div className={styles.row}>
                        <p className="text-light">Date</p>
                        <p className="flex items-center gap-2">{formatFullDate(data.date)}</p>
                    </div>

                    <div className={styles.row}>
                        <p className="text-light">Category</p>
                        <p className="flex items-center gap-2">{typeToCopy[data.type]}</p>
                    </div>

                    {data.transactionHash.startsWith('intent') && (
                        <div className={styles.row}>
                            <p className="flex items-center gap-2">
                                Pending transaction; the block explorer link will be available once the transaction is confirmed.
                            </p>
                        </div>
                    )}
                    {!data.transactionHash.startsWith('intent') && (
                        <Link href={`https://optimistic.etherscan.io/tx/${data.transactionHash}`} target="_blank">
                            <div className={styles.row}>
                                <p className="text-sm">View on Block Explorer</p>
                                <p className="flex items-center gap-2">
                                    <IoIosArrowRoundForward />
                                </p>
                            </div>
                        </Link>
                    )}

                    <div onClick={onClose} className={styles.cta}>
                        <button className="btn btn-primary">Close</button>
                    </div>
                </div>
            </div>
        </>
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
