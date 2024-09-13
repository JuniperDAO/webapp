import { AssetPricesContext } from '@/context/AssetPrices/AssetPricesContext'
import { JuniperTransaction, JuniperTransactionType, signForTransactionType } from '@/libs/transactionHistory/types'
import { formatMoney } from '@/libs/util/formatMoney'
import DepositIcon from '@/public/icons/DepositIcon'
import RepaymentIcon from '@/public/icons/RepaymentIcon'
import SpendIcon from '@/public/icons/SpendIcon'
import WithdrawIcon from '@/public/icons/WithdrawIcon'
import JuniperTree from '@/public/icons/JuniperTree'
import styles from '@/styles/Transactions.module.css'
import { useContext, useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { formatAddress } from '@/libs/util/formatAddress'
import { CardAccountContext, getCardAccountDisplayInfo } from '@/context/CardAccounts/CardAccounts'
import { INTENT_EXPIRATION_S } from '@/libs/constants'
import { redact } from '@/libs/util/log'

const iconMap = {
    [JuniperTransactionType.Repay]: <RepaymentIcon />,
    [JuniperTransactionType.Deposit]: <DepositIcon />,
    [JuniperTransactionType.Spend]: <SpendIcon />,
    [JuniperTransactionType.Withdraw]: <WithdrawIcon />,
    [JuniperTransactionType.Fee]: <JuniperTree />,
    [JuniperTransactionType.ReferralBonus]: <DepositIcon />,
}

type TransactionProps = {
    txn: JuniperTransaction
    onClick: (txn: JuniperTransaction) => void
}

export const typeToCopy = {
    [JuniperTransactionType.Deposit]: 'Deposit',
    [JuniperTransactionType.Repay]: 'Repayment',
    [JuniperTransactionType.Spend]: 'Send',
    [JuniperTransactionType.Withdraw]: 'Withdrawal',
    [JuniperTransactionType.Fee]: 'Fee',
    [JuniperTransactionType.ReferralBonus]: 'Referral Bonus',
}

function isIntentTxn(txn: JuniperTransaction) {
    return txn?.transactionHash?.startsWith('intent')
}

function isExpiredTxn(txn: JuniperTransaction) {
    return isIntentTxn(txn) && new Date(txn.date).getTime() + INTENT_EXPIRATION_S * 1000 < new Date().getTime()
}

const Transaction: React.FC<TransactionProps> = ({ txn, onClick }) => {
    // TODO - if the transaction list gets large,
    // this might not be the most performant way to do this
    const { ethPriceUSD, getPriceByAssetName, isLoading } = useContext(AssetPricesContext)
    const { cardAccounts, isLoading: isLoadingCardAccounts, addressToCardAccountMap } = useContext(CardAccountContext)

    const [primaryAssetAmount, setPrimaryAssetAmount] = useState<string>('')
    const [secondaryAssetAmount, setSecondaryAssetAmount] = useState<string>('')

    const getTxnCopy = (txn) => {
        let copy = ''
        if (txn.type === JuniperTransactionType.Spend) {
            const cardAccount = addressToCardAccountMap.get(txn.to.toLowerCase())

            if (cardAccount) {
                const info = getCardAccountDisplayInfo(cardAccount)
                copy = `Send to ${info.name}`
            } else {
                copy = `Send to ${formatAddress(txn.to)}`
            }
        } else {
            copy = typeToCopy[txn.type]
        }

        if (isExpiredTxn(txn)) {
            copy = copy + ' (Failed)'
        } else if (isIntentTxn(txn)) {
            copy = copy + '(Pending)'
        }

        return copy
    }

    useEffect(() => {
        if (isLoading) return
        if (isLoadingCardAccounts) return

        const asset = txn.amount.toFixed(txn.currency?.startsWith('USDC') ? 2 : 5) + ' ' + (txn.currency === 'WETH' ? 'ETH' : txn.currency)

        if (txn.amount) {
            const price = getPriceByAssetName(txn.currency)
            if (price) {
                const amountUSD = Number(txn.amount) * Number(price)
                const amountUSDFormatted = formatMoney(amountUSD)

                setPrimaryAssetAmount(amountUSDFormatted)
            }

            setSecondaryAssetAmount(asset)
        } else if (!isExpiredTxn(txn)) {
            setPrimaryAssetAmount('Pending')
            setSecondaryAssetAmount('Pending')
        }
    }, [isLoading, getPriceByAssetName, ethPriceUSD, cardAccounts, isLoadingCardAccounts])

    const isLoss = txn.type === JuniperTransactionType.Spend || txn.type === JuniperTransactionType.Withdraw

    return (
        <div
            onClick={() => {
                onClick(txn)
            }}
            className={styles.transaction}>
            <div className="flex gap-2 items-center">
                {iconMap[txn.type]}
                <div>
                    <p className={`text-sm ${isIntentTxn(txn) ? 'italic' : 'font-semibold'} ${isExpiredTxn(txn) ? 'text-red-700' : 'text-dark'}`}>
                        {getTxnCopy(txn)}
                    </p>

                    <p className="text-xs text-[#959893]">
                        {formatDistanceToNow(new Date(txn.date), {
                            addSuffix: true,
                        })}
                        <br />
                        {!isIntentTxn(txn) && redact(txn.transactionHash, 8, 8)}
                    </p>
                </div>
            </div>
            <div>
                <p className={`text-sm text-end ${!isLoss ? 'text-[#8C8E1B]' : 'text-[#2b3026]'}`}>
                    {!isExpiredTxn(txn) && signForTransactionType(txn.type)} {primaryAssetAmount}
                </p>
                <p className="text-xs text-[#959893] text-right">{secondaryAssetAmount}</p>
            </div>
        </div>
    )
}

export default Transaction
