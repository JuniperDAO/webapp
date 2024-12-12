import styles from '@/styles/RepayModal.module.css'
import { useContext, useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { inter } from '@/libs/font'
import { IoIosCopy, IoMdClose } from 'react-icons/io'
import { toast } from 'sonner'
import { QRCodeSVG } from 'qrcode.react'
import { userContext } from '@/context/user/userContext'
import { useETHDepositTracker, useERC20DepositTracker } from '@/hooks/useDepositTracker'
import { Network } from '@/libs/network/types'
import { AAVE_SUPPORTED_STABLES, ONE_DOLLAR, safeStringify } from '@/libs/constants'
import { Loading } from '@/public/icons/StatusIcons'
import { creditLineContext } from '@/context/CreditLine/creditLineContext'
import { AnimatePresence, motion } from 'framer-motion'
import { header, page } from '@/libs/animate'
import { AssetPricesContext } from '@/context/AssetPrices/AssetPricesContext'
import { toWei, toEth } from '@/libs/util/toEth'
import { staticURL } from '@/libs/constants'
import { POST } from '@/libs/request'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { getERC20Balance } from '@/libs/util/getERC20Balance'

import { log } from '@/libs/util/log'
import { analytics } from '@/libs/evkv'

import { AaveRepay } from '@/libs/repay/AaveRepay'
import { bigMin } from '@/libs/util/toEth'
import { txnsToUserOp } from '@/libs/zerodev'
import { getAllStableBalances } from '@/libs/util/getERC20Balance'
import { swapStablesForStable } from '@/libs/lineRepayment/swapERC20'
import { AaveLoanInfo } from '@/libs/borrow/AaveLoanInfo'
import { SessionKeySigner } from '@/libs/zerodev/SessionKeySigner'

export default function RepayModal({ onClose, show }) {
    const [isBrowser, setIsBrowser] = useState(false)

    useEffect(() => {
        setIsBrowser(true)
    }, [])

    const handleClose = () => {
        onClose()
    }

    if (isBrowser && show) {
        return ReactDOM.createPortal(
            <ModalContent handleClose={handleClose} />,
            // @ts-ignore
            document.getElementById('modal-root')
        )
    } else {
        return null
    }
}

/**
 * NOTE: it is important that this content is unmounted when the modal is closed
 * Because the deposit listener can unintentionally send USDC back to aave if it
 * remains running in the background, unmounting cleans up the listener.
 */
const ModalContent = ({ handleClose }) => {
    const { user, smartWalletAddress, sessionKey } = useContext(userContext)
    const { refreshLoanInfo } = useContext(creditLineContext)

    const [isSuccess, setIsSuccess] = useState(false)
    const [isRepaying, setIsRepaying] = useState(false)
    const [hasStartedRepay, setHasStartedRepay] = useState(false)

    // stablecoin detectors
    const deposits = AAVE_SUPPORTED_STABLES.map((symbol) => {
        return useERC20DepositTracker(smartWalletAddress, Network.optimism, symbol, AaveV3Optimism.ASSETS[symbol].UNDERLYING, toWei('0'), true)
    })

    // raw ETH detector
    const deps: any[] = deposits.slice()
    deps.push(useETHDepositTracker(smartWalletAddress, Network.optimism, toWei('0'), true))

    // more dependencies
    deps.push(smartWalletAddress, isRepaying, hasStartedRepay)

    // once there is a deposit, run
    useEffect(() => {
        async function repay() {
            if (isRepaying || hasStartedRepay) return

            const debtE = await getERC20Balance(smartWalletAddress, Network.optimism, AaveV3Optimism.ASSETS.USDC.V_TOKEN)
            const debtN = await getERC20Balance(smartWalletAddress, Network.optimism, AaveV3Optimism.ASSETS.USDCn.V_TOKEN)

            const hasDeposited = deposits.some((deposit) => deposit.amount.gt(ONE_DOLLAR))
            const isReady = smartWalletAddress

            if (!hasDeposited || !isReady) return

            setIsRepaying(true)
            setHasStartedRepay(true)

            const signer = new SessionKeySigner(smartWalletAddress, sessionKey)
            const loanInfo = new AaveLoanInfo(smartWalletAddress)
            const accountInfo = await loanInfo.getAccountInfoWei()
            if (accountInfo.totalDebtWei.lte(0)) {
                throw new Error(`${smartWalletAddress} has no debt to repay`)
            }
            const stableBalance = await getAllStableBalances(smartWalletAddress, Network.optimism)
            log(`${smartWalletAddress} has ${stableBalance} of stables and ${accountInfo.totalDebtWei} of debt`)

            analytics.track('repayLine', { smartWalletAddress, stableBalance, ...accountInfo })

            // XXX no longer support ETH repayments?
            // since we previously borrowed in Bridged USDC (e), and now use USDCn, we need to check each. Clear out the (e) debt first if possible. we only use variable debt, so V_TOKENs
            for (const symbol of ['USDC', 'USDCn']) {
                const asset = AaveV3Optimism.ASSETS[symbol]
                const debt = await getERC20Balance(smartWalletAddress, Network.optimism, asset.V_TOKEN)

                if (debt.lte(0)) {
                    log(`${smartWalletAddress} no debt for ${symbol}`)
                    continue
                }

                let balance = await getERC20Balance(smartWalletAddress, Network.optimism, asset.UNDERLYING)
                log(`${smartWalletAddress} debt: ${symbol}: ${debt}, balance: ${balance}`)

                if (balance.lt(debt)) {
                    log(`${smartWalletAddress} swapping stables to get ${debt} of ${symbol} (have ${balance})`)
                    // the debt can be much more than the available stable balance
                    await swapStablesForStable(debt, signer, AAVE_SUPPORTED_STABLES, symbol)
                    balance = await getERC20Balance(smartWalletAddress, Network.optimism, asset.UNDERLYING)
                } else {
                    log(`${smartWalletAddress} have ${balance} of ${symbol} to repay of ${debt} debt, no swap`)
                }

                // afaict AaveRepay isn't stateful, but we still create a new one each time
                const aaveRepay = new AaveRepay(signer)
                if (balance.gt(0)) {
                    log(`${smartWalletAddress} ${symbol} have ${balance} of ${debt} to repay`)
                    const { approvalTx, repayTx } = await aaveRepay.prepareRepay(asset.UNDERLYING, bigMin(balance, debt))

                    const approvalResponse = await signer.sendUserOperation(txnsToUserOp([approvalTx])[0])
                    log(`${smartWalletAddress} approval to repay ${symbol}: ${safeStringify(approvalResponse)}`)

                    const repayResponse = await signer.sendUserOperation(txnsToUserOp([repayTx])[0])
                    log(`${smartWalletAddress} repay response ${symbol}: ${safeStringify(repayResponse)}`)

                    analytics.track('repayLineResponse', { approvalResponse, repayResponse })
                } else {
                    log(`${smartWalletAddress} ${symbol} have ${balance} of ${debt}, cannot repay`)
                }
            }

            setIsSuccess(true)
            setIsRepaying(false)

            // refresh the loan info so the dashboard updates
            await refreshLoanInfo(smartWalletAddress)
        }

        repay().then(null)
    }, deps)

    return (
        <AnimatePresence mode="wait">
            <motion.div initial="initial" animate="animate" exit="exit" key="overlay" variants={header} onClick={handleClose} className="overlay" />

            {isSuccess ? (
                <Success onClose={handleClose} />
            ) : isRepaying ? (
                <Repaying />
            ) : (
                <WaitForRepayDeposit onClose={handleClose} receiveAddress={smartWalletAddress} />
            )}
        </AnimatePresence>
    )
}

function Repaying() {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            key="modal"
            layoutId="modal"
            variants={page}
            className={`h-[500px] centered modal ${styles.container} ${inter.className}`}>
            <Loading />
            <p className="mt-3 text-center">
                Deposit received! <br />
            </p>
        </motion.div>
    )
}

function WaitForRepayDeposit({ onClose, receiveAddress }) {
    const { ethPriceUSD } = useContext(AssetPricesContext)
    const { totalDebtUSD } = useContext(creditLineContext)
    // account for slippage
    const totalDebtUSDWithSlippage = Math.max(totalDebtUSD * 1.01, 1).toFixed(2)

    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            key="modal"
            layoutId="modal"
            variants={page}
            className={`modal ${styles.container} ${inter.className}`}>
            <div className={styles.header}>
                <IoMdClose onClick={onClose} className={styles.backIcon} size={20} />
                <h3 className="spectral text-2xl text-dark">Make a Repayment</h3>
            </div>
            <div className={styles.content}>
                <p className="mt-4 text-sm max-w-sm mx-auto text-dark">
                    Send up to ${totalDebtUSDWithSlippage} USDC (bridged or native), USDT, or DAI to this address to repay. Send on the Optimism L2 network, or{' '}
                    <b>your funds will be lost</b>.
                </p>

                <div className="centered mt-6 mb-6">
                    <div className={styles.qrWrapper}>
                        <QRCodeSVG
                            value={`ethereum:${receiveAddress}`}
                            size={180}
                            fgColor={'#4A5443'}
                            bgColor="transparent"
                            level="Q"
                            // imageSettings={{
                            //     src: staticURL('/images/optimism.png'),
                            //     height: 40,
                            //     width: 40,
                            //     excavate: true,
                            // }}
                        />
                    </div>
                </div>

                <div
                    className="cursor-pointer"
                    onClick={() => {
                        toast('Copied to clipboard.')
                        navigator.clipboard.writeText(receiveAddress)
                    }}>
                    <div className={styles.address}>
                        <p>{receiveAddress}</p>
                        <IoIosCopy size={20} />
                    </div>
                    <p className="mt-1 text-xs text-light">Tap to copy address</p>
                </div>

                <p className="mt-4 text-sm text-light">
                    <b>Status:</b> Waiting for stablecoin deposit...
                </p>
            </div>
        </motion.div>
    )
}

function Success({ onClose }) {
    return (
        <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            key="modal"
            layoutId="modal"
            variants={page}
            className={`modal ${styles.container} ${inter.className}`}>
            <div className={styles.content}>
                <img width={200} height={200} src={staticURL('/images/otherCard.png')} alt="coinbase" />

                <h3 className="text-2xl spectral mb-1 mt-auto md:mt-2">Repayment Scheduled</h3>

                <p>Your balance will be updated shortly.</p>

                <div className="mt-10 md:mt-4">
                    <button onClick={onClose} className="btn btn-primary">
                        Close
                    </button>
                </div>
            </div>
        </motion.div>
    )
}
