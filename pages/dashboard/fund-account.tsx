import styles from '@/styles/FundAccount.module.css'
import Layout from '@/components/Reusable/Layout'
import { useRouter } from 'next/router'
import { IoIosCopy, IoMdClose } from 'react-icons/io'
import { toast } from 'sonner'
import { useState, useContext, useEffect } from 'react'
import { useETHDepositTracker, useERC20DepositTracker } from '@/hooks/useDepositTracker'
import { QRCodeSVG } from 'qrcode.react'
import { Network } from '@/libs/network/types'
import { toEth, toWei, toFixedCeil } from '@/libs/util/toEth'
import { AssetPricesContext } from '@/context/AssetPrices/AssetPricesContext'
import { formatMoney } from '@/libs/util/formatMoney'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'
import { BigNumber, Contract } from 'ethers'
import { analytics } from '@/libs/evkv'
import { HelpdeskLink } from '@/components/Reusable/HelpdeskLink'
import { getReadProvider } from '@/libs/getReadProvider'
import { userContext } from '@/context/user/userContext'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

import { POST } from '@/libs/request'

import {
    ETH_MINIMUM_DEPOSIT_USD,
    ETH_PRECISION_FIXED,
    ETH_DISPLAY_PRECISION_FIXED,
    AAVE_SUPPLIABLE_ERC20_ADDRESSES,
    staticURL,
    safeStringify,
} from '@/libs/constants'
import { AAVE_POOL_ABI } from '@/libs/deposit/AavePoolABI'

export default function FundAccount() {
    const router = useRouter()
    const { smartWalletAddress } = useContext(userContext)
    // ugly...
    const { ethPriceUSD, aavePriceUSD, linkPriceUSD, opPriceUSD, wbtcPriceUSD, rethPriceUSD, wstethPriceUSD, lidoAPR } = useContext(AssetPricesContext)

    const minDeposits = new Map<string, BigNumber>()
    const deposits = [
        // raw ETH in the smart wallet...
        useETHDepositTracker(smartWalletAddress, Network.optimism, BigNumber.from(0), true),
        // or any of Aave's supported, non-stable tokens
        ...Array.from(AAVE_SUPPLIABLE_ERC20_ADDRESSES.entries()).map(([symbol, address]) => {
            return useERC20DepositTracker(smartWalletAddress, Network.optimism, symbol, address, BigNumber.from(0), true)
        }),
    ]
    const depositsAndPrices = [...deposits, ethPriceUSD, aavePriceUSD, linkPriceUSD, opPriceUSD, wbtcPriceUSD, rethPriceUSD, wstethPriceUSD]

    minDeposits.set('ETH', toWei((ETH_MINIMUM_DEPOSIT_USD / ethPriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('WETH', toWei((ETH_MINIMUM_DEPOSIT_USD / ethPriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('AAVE', toWei((ETH_MINIMUM_DEPOSIT_USD / aavePriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('LINK', toWei((ETH_MINIMUM_DEPOSIT_USD / linkPriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('OP', toWei((ETH_MINIMUM_DEPOSIT_USD / opPriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('WBTC', toWei((ETH_MINIMUM_DEPOSIT_USD / wbtcPriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('RETH', toWei((ETH_MINIMUM_DEPOSIT_USD / rethPriceUSD).toFixed(ETH_PRECISION_FIXED)))
    minDeposits.set('WSTETH', toWei((ETH_MINIMUM_DEPOSIT_USD / wstethPriceUSD).toFixed(ETH_PRECISION_FIXED)))

    useEffect(() => {
        let deposit = deposits.find((n) => {
            return n.amount.gt(0)
        })

        if (deposit) {
            const minDepositWei = minDeposits.get(deposit?.symbol.toUpperCase())
            console.log(`minDepositWei: ${minDepositWei} for ${deposit?.symbol}`)
            if (minDepositWei) {
                if (deposit?.amount.gt(minDepositWei)) {
                    console.log(`sufficient deposit found: ${safeStringify(deposit)}`)

                    analytics.track('fundAccountDepositFound', {
                        minDeposit: minDepositWei.toString(),
                        ...deposit,
                    })

                    const intent = async () => {
                        const res = await POST(`/api/wallet/fund`, {
                            amount: deposit.amount.toString(),
                            symbol: deposit.symbol,
                            smartWalletAddress,
                        })
                        console.log('res', res)

                        toast.success(`${toEth(deposit.amount)} ${deposit.symbol} deposit received.`)
                        router.push('/dashboard')
                    }

                    intent()
                } else if (deposit?.amount.gt(0)) {
                    console.log(`insufficient deposit found: ${safeStringify(deposit)}`)
                    toast.error(`${toEth(deposit.amount)} ${deposit.symbol} is below minimum deposit, please try again.`)
                    router.push('/dashboard')

                    analytics.track('fundAccountTraceAmountFound', {
                        minDeposit: minDepositWei.toString(),
                        ...deposit,
                    })
                }
            } else {
                throw new Error(`no minDeposit found for ${deposit?.symbol}`)
            }
        }
    }, depositsAndPrices) // NOTE! this is a dependency array, so do NOT just chain stuff to the end here

    return (
        <Layout>
            <div className={styles.container}>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    <Link href="/dashboard" className="absolute top-[18px] left-[22px] text-sm hover:text-blue-700">
                        <IoMdClose size={20} />
                    </Link>

                    <h3>Fund Your Wallet</h3>
                    <p className="mt-1 text-sm max-w-sm mx-auto text-dark">
                        Juniper supports <strong>ETH, {Array.from(AAVE_SUPPLIABLE_ERC20_ADDRESSES.keys()).sort().join(', ')}</strong>. Fund your wallet on
                        Optimism's L2 network, or funds will be lost.
                    </p>
                    <div className="mt-2">
                        <HelpdeskLink slug="choosing-a-deposit-network-13idbcd" text="How do I do this?" />
                    </div>
                    <div className={`mt-3 ${styles.centered}`}>
                        <div className={styles.qrWrapper}>
                            {smartWalletAddress ? (
                                <QRCodeSVG
                                    value={`ethereum:${smartWalletAddress}`}
                                    size={220}
                                    fgColor={'#4A5443'}
                                    bgColor="transparent"
                                    level="Q"
                                    // imageSettings={{
                                    //     src: staticURL('/public/images/optimism.png'),
                                    //     height: 40,
                                    //     width: 40,
                                    //     excavate: true,
                                    // }}
                                />
                            ) : null}
                        </div>
                    </div>

                    <p className="text-xs text-light mt-2">
                        (Min. deposit ${ETH_MINIMUM_DEPOSIT_USD} / Ξ{(ETH_MINIMUM_DEPOSIT_USD / ethPriceUSD).toFixed(ETH_DISPLAY_PRECISION_FIXED)} @{' '}
                        {formatMoney(ethPriceUSD)}/ETH)
                    </p>

                    <div
                        className="cursor-pointer mt-4"
                        onClick={() => {
                            toast('Copied to clipboard.')
                            navigator.clipboard.writeText(smartWalletAddress)
                        }}>
                        <div className={styles.address}>
                            <p className={styles.addressText}>{smartWalletAddress}</p>
                            <IoIosCopy size={20} />
                        </div>
                        {/* <p className="mt-1 text-xs text-light">Tap to copy address</p> */}
                    </div>

                    <p className="text-xs text-light mt-2">Current yields:</p>

                    <div className="mt-1">
                        <div className="flex justify-between">
                            <div className="w-1/2">
                                <p className="font-bold">Asset</p>
                            </div>
                            <div className="w-1/2">
                                <p className="font-bold">Earn Up To</p>
                            </div>
                        </div>
                        {Array.from(AAVE_SUPPLIABLE_ERC20_ADDRESSES.keys()).map((assetName, index) => (
                            <div className="flex justify-between" key={index}>
                                <div className="w-1/2">
                                    <p>{assetName === 'WETH' ? 'ETH' : assetName}</p>
                                </div>
                                <div className="w-1/2">
                                    <p>
                                        {['WETH', 'wstETH'].includes(assetName)
                                            ? lidoAPR.toFixed(2)
                                            : assetName === 'rETH'
                                              ? Number(lidoAPR * 0.95).toFixed(2)
                                              : '<0.1'}
                                        %
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* <Link className="mt-3 underline text-sm cursor-pointer text-center" href="/dashboard">
                        Return to dashboard
                    </Link> */}
                </motion.div>
            </div>
        </Layout>
    )
}
