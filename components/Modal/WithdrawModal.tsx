/* eslint-disable @next/next/no-img-element */
import { BigNumber } from 'ethers'
import styles from '@/styles/WithdrawModal.module.css'
import { useCallback, useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { inter } from '@/libs/font'
import Link from 'next/link'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { toast } from 'sonner'
import { formatMoney } from '@/libs/util/formatMoney'
import { IoMdClose } from 'react-icons/io'
import * as yup from 'yup'
import { yupResolver } from '@hookform/resolvers/yup'
import { useForm } from 'react-hook-form'
import { userContext } from '@/context/user/userContext'
import { AnimatePresence, motion } from 'framer-motion'
import { header, page } from '@/libs/animate'
import { AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE, OFAC_ADDRESSES } from '@/libs/constants'
import { analytics } from 'libs/evkv'
import { POST } from '@/libs/request'
import { getAllATokenBalances } from '@/libs/util/getERC20Balance'
import { Network } from '@/libs/network/types'
import { toEth } from '@/libs/util/toEth'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'


import { ERC20Send } from '@/libs/send/ERC20Send'
import { getERC20Balance } from '@/libs/util/getERC20Balance'
import { log } from '@/libs/util/log'
import { txnsToUserOp } from '@/libs/zerodev'

import { AaveWithdraw } from '@/libs/withdraw/AaveWithdraw'
import { AAVE_SUPPLIABLE_ERC20_ADDRESSES, safeStringify } from '@/libs/constants'
import { SessionKeySigner } from '@/libs/zerodev/SessionKeySigner'

const schema = yup
    .object({
        address: yup
            .string()
            .length(42, 'Invalid address')
            .test({
                name: 'is-addr',
                skipAbsent: true,
                test(value, ctx) {
                    if (!value.startsWith('0x')) {
                        analytics.track('invalidWithdrawAddress', {
                            address: value,
                        })
                        return ctx.createError({
                            message: 'Invalid address',
                        })
                    }
                    return true
                },
            })
            .test({
                name: 'ofac',
                skipAbsent: true,
                test(value, ctx) {
                    if (OFAC_ADDRESSES.includes(value.toLowerCase())) {
                        analytics.track('ofacDenylistOnWithdraw', {
                            address: value,
                        })

                        return ctx.createError({
                            message: 'Invalid address.',
                        })
                    }
                    return true
                },
            })
            .required('This field can’t be empty'),
    })
    .required()

export default function WithdrawModal({ show, onClose }) {
    const [isBrowser, setIsBrowser] = useState(false)
    const [containedAssets, setContainedAssets] = useState(null)
    const { smartWalletAddress, sessionKey } = useContext(userContext)
    const { totalDebtUSD, refreshLoanInfo } = useContext(creditLineContext)
    const { register, handleSubmit, formState, watch } = useForm({
        resolver: yupResolver(schema),
    })

    const destinationAddress = watch(['address'])[0]

    useEffect(() => {
        setIsBrowser(true)

        console.log(AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE)
        const getSymbols = async () => {
            setContainedAssets(await getAllATokenBalances(smartWalletAddress, Network.optimism))
        }
        getSymbols()
    }, [])

    const { errors, isSubmitting } = formState

    const onWithdraw = useCallback(async () => {
        try {
            if (totalDebtUSD > 0) {
                analytics.track('withdrawFailedDebt', {
                    totalDebtUSD: totalDebtUSD,
                })

                throw new Error(`You must repay your ${formatMoney(totalDebtUSD)} balance  before withdrawing.`)
            }

            const signer = new SessionKeySigner(smartWalletAddress, sessionKey)
            const address = await signer.getAddress()
            const withdraw = new AaveWithdraw(signer)

            for (const [symbol, info] of Object.entries(AaveV3Optimism.ASSETS)) {
                if (AAVE_SUPPLIABLE_ERC20_ADDRESSES.get(symbol)) {
                    const balance = await getERC20Balance(address, Network.optimism, info.A_TOKEN)
                    if (balance.gt(0)) {
                        const preparedTxn = await withdraw.prepareWithdrawAll(symbol, info)
                        if (preparedTxn) {
                            const userOp = txnsToUserOp([preparedTxn])
                            log(`Withdrawing ${toEth(balance)} ${symbol} from Aave...`)
                            const wres = await signer.sendUserOperation(userOp)
                            log(`Withdrawal tx hash: ${safeStringify(wres)}`)
                        }
                    }
                }
            }

            const txids = {}
            for (const [symbol, info] of Object.entries(AaveV3Optimism.ASSETS)) {
                if (AAVE_SUPPLIABLE_ERC20_ADDRESSES.get(symbol) || symbol === 'USDC' || symbol === 'USDCn') {
                    const send = new ERC20Send(info.UNDERLYING, signer)
                    const newBalance = await getERC20Balance(address, Network.optimism, info.UNDERLYING)
                    if (newBalance.gt(0)) {
                        const preparedSendTxn = await send.prepareSend(newBalance, destinationAddress)
                        const txid = await signer.sendUserOperation(txnsToUserOp([preparedSendTxn]))
                        log(`Sent ${symbol} to withdrawAddress ${destinationAddress} txid ${txid}`)
                        txids[symbol] = txid
                    } else {
                        log(`No ${symbol} to send`)
                    }
                }
            }

            analytics.track('withdraw', { address: destinationAddress })

            toast.success(`Withdrawal to ${destinationAddress} in progress.`)

            await refreshLoanInfo(smartWalletAddress)

            onClose()
        } catch (error) {
            console.log(error)
            toast.error(error.message, {
                position: 'top-center',
            })
        }
    }, [totalDebtUSD, destinationAddress, smartWalletAddress])

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
                    <h3 className="spectral text-2xl text-dark">Withdraw Your Assets</h3>
                </div>
                <div className={styles.content}>
                    <p className="mt-4 text-sm max-w-sm mx-auto text-dark">
                        Assets are withdrawn on{' '}
                        <Link target="_blank" href="https://www.optimism.io" className={styles.links}>
                            Optimism
                        </Link>
                        . Make sure that the wallet or exchange to which you withdraw supports receiving assets on Optimism, or{' '}
                        <strong>your funds may be lost</strong>.
                    </p>
                    {containedAssets && (
                        <p className="mt-4 text-sm max-w-sm mx-auto text-dark">
                            <div style={{ backgroundColor: 'white' }}>
                                Your smart wallet contains:
                                {Object.entries(containedAssets).map(([key, value]) => (
                                    <div key={key} className="grid grid-cols-2 gap-4" style={{ backgroundColor: 'lightgrey' }}>
                                        <span className="font-bold">{AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE.get(key.toLowerCase())}: </span>
                                        <span>{toEth(BigNumber.from(value)).toFixed(4)}</span>
                                    </div>
                                ))}
                                <p className="mt-4 text-xs">
                                    Make sure the address to which you are sending supports{' '}
                                    {Object.entries(containedAssets)
                                        .map(([key]) => AAVE_SUPPLIABLE_ERC20_ADDRESSES_INVERSE.get(key.toLowerCase()))
                                        .join(', ')}
                                    , or <span className="font-bold">funds may be lost</span>. Some CEXes accept a limited number of ERC20 tokens. We recommend
                                    withdrawing to another self-custody wallet. Juniper does not swap any assets on withdrawal.
                                </p>
                            </div>
                        </p>
                    )}
                    <input
                        className={`${styles.input} ${errors.address?.message ? 'error-msg' : ''}`}
                        {...register('address')}
                        disabled={isSubmitting}
                        type="text"
                        placeholder="0x... Your Optimism address"
                    />
                    <p className="error-msg text-start">{errors.address?.message}</p>

                    <div className="flex flex-col gap-3 mt-auto md:mt-6">
                        <button
                            onClick={handleSubmit(onWithdraw)}
                            disabled={isSubmitting || destinationAddress?.length !== 42}
                            className={`btn btn-danger ${isSubmitting ? 'btn-loading' : ''} `}>
                            {isSubmitting ? 'Withdrawing...' : 'Withdraw'}
                        </button>
                        <button
                            onClick={() => {
                                if (isSubmitting) return
                                onClose()
                            }}
                            className={`btn btn-secondary ${isSubmitting ? 'btn-loading' : ''} `}>
                            Cancel
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
