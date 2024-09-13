import styles from '@/styles/Connect.module.css'
import { useCallback, useContext, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import { CardAccountContext } from '@/context/CardAccounts/CardAccounts'
import { IoMdClose } from 'react-icons/io'
import { toast } from 'sonner'
import Link from 'next/link'
import { Loading } from '@/public/icons/StatusIcons'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'
import { analytics } from 'libs/evkv'
import { userContext } from '@/context/user/userContext'
import { POST } from '@/libs/request'
import LaunchLink from '@/components/LaunchLink'
import { PlaidLinkError, PlaidLinkOnExitMetadata, PlaidLinkOnSuccessMetadata } from 'react-plaid-link'

import { triggerChatSupportError } from '@/libs/crisp-error'
import { log } from '@/libs/util/log'
import { safeStringify } from '@/libs/constants'
import { getExchangeDisplayName, getExchanges } from '@/context/CardAccounts/CardAccounts'

enum FlowStateStep {
    SelectAccountType,
    ConnectWallet,
    ConnectExchange,
    Tos,
    Kyc,
    Plaid,
}

/*
    KYC FLOWS ARE MY ABSOLUTE FAVORITE
    * A user can re-enter after finishing anything

    1. Get the TOS, KYC links for the user's e-mail. Normal flow is to create, but
*/

export default function Connect() {
    const router = useRouter()
    const { user, smartWalletAddress, updateSessionSigner } = useContext(userContext)
    const { isLoading, refreshCardAccounts, cardAccounts } = useContext(CardAccountContext)
    const [kycStep, setKycStep] = useState(FlowStateStep.SelectAccountType)
    const [tosLink, setTosLink] = useState('')
    const [kycLink, setKycLink] = useState('')
    const [kycLinkId, setKycLinkId] = useState('')
    const [linkToken, setLinkToken] = useState(null)
    const [walletName, setWalletName] = useState('')
    const [walletAddress, setWalletAddress] = useState('')
    const [selectedExchangeType, setSelectedExchangeType] = useState('')
    const isSaving = useRef(false)

    const _loadBridgeAccounts = async () => {
        try {
            const res = await POST('/api/bridge/kyc', {})
            if (res.status !== 200) throw res.error

            const { userBridge } = res.data as any

            setKycLinkId(userBridge.id)
            setTosLink(userBridge.tosLink)

            const kycLinkUrl = new URL(userBridge.kycLink)
            kycLinkUrl.searchParams.set('environment', 'production')
            kycLinkUrl.searchParams.set('iframe-origin', window.location.origin)
            kycLinkUrl.searchParams.set('message-target-origin', window.location.origin)
            kycLinkUrl.pathname = '/widget'

            analytics.track('kycLinkReceived', { original: userBridge.kycLink, modified: kycLinkUrl.toString() })

            setKycLink(kycLinkUrl.toString())

            if (userBridge.tosStatus === 'approved' && userBridge.kycStatus === 'approved') {
                // do 1 more KYC poll to get the link token before running plaid
                // do nothing, react state re-render will handle changing to polling
                setKycStep(FlowStateStep.Plaid)
            } else if (userBridge.tosStatus === 'approved') {
                setKycStep(FlowStateStep.Kyc)
            } else {
                setKycStep(FlowStateStep.Tos)
            }
        } catch (err) {
            triggerChatSupportError(err, smartWalletAddress)
        }
    }

    let pollingKycStatus = false
    let pollingErrorReported = false
    const pollKycStatus = async (interval?: number) => {
        if (!kycLinkId) throw new Error('kycLinkId is not set')
        if (!linkToken) {
            // save off the completed info with the customer id, if needed
            if (pollingKycStatus) {
                log('pollKycStatus already polling')
                return
            }
            pollingKycStatus = true
            try {
                const res = await POST(`/api/bridge/kyc/${kycLinkId}`, {})
                log('pollKycStatus', res)

                // poll, expo backoff to 10s
                if (res?.data?.customer_id && res?.data?.kyc_status !== 'pending') {
                    if (res.data.kyc_status === 'approved') {
                        const plaidRes = await POST(`/api/plaid/link-token`, {})

                        setLinkToken(plaidRes.data.link_token)
                        setKycStep(FlowStateStep.Plaid)
                    } else if (res.data.kyc_status === 'rejected') {
                        triggerChatSupportError(new Error('KYC failed'), smartWalletAddress)
                    }
                } else {
                    interval = Math.min((interval || 500) * 2, 10000)
                    log('pollKycStatus retrying in', interval)
                    setTimeout(function () {
                        pollKycStatus(interval)
                    }, interval)
                }
            } catch (error) {
                if (!pollingErrorReported) {
                    pollingErrorReported = true
                    triggerChatSupportError(error, smartWalletAddress)
                }
            }
            pollingKycStatus = false
        }
    }

    const onPostMessage = useCallback(
        async (ev) => {
            if (ev.data?.name) {
                analytics.track('personaEvent', ev.data)

                // persona event, e.g., {containerId: undefined, templateId: "itmpl_NtHYpb9AbEYCPxGo5iRbc9d2", templateVersionId: undefined, name: "start", metadata: {inquiryId: "inq_Me9sFq9xQf5eLQeEP73Nzxrp"}} = $1
                const { name, metadata } = ev.data
                switch (name) {
                    case 'complete': {
                        // react re-render will handle changing to polling
                        // pollKycStatus()
                        break
                    }
                    case 'exit': {
                        setKycStep(FlowStateStep.SelectAccountType)
                        setKycLinkId(null)
                        router.push('/dashboard')
                        toast.error('Account connection cancelled.')
                        break
                    }
                }
            } else {
                // bridge event
                // event.data contains the data sent in the postMessage
                analytics.track('bridgeEvent', ev.data)
                const { signedAgreementId } = ev.data

                if (!signedAgreementId || !kycLink || !kycLinkId) return

                const signedAgreementIdRes = await POST(`/api/bridge/kyc/${kycLinkId}`, { signedAgreementId })
                analytics.track('signedBridgeAgreement', { id: signedAgreementId, response: signedAgreementIdRes })

                // OK so they signed that, let's take them to persona
                setKycStep(FlowStateStep.Kyc)
            }
        },
        [kycLink, kycLinkId]
    )

    // react is black magic
    useEffect(() => {
        if (isLoading) return

        refreshCardAccounts()

        // don't do the kyc poll if we're past that at the select account screen
        if (kycLinkId) {
            pollKycStatus()
        }

        // if we have a kyc link id, we need to listen for the plaid and persona
        if (kycLinkId && kycLink) {
            window.addEventListener('message', onPostMessage)

            // Make sure to clean up the event listener when the component unmounts or kycLinkId changes
            return () => {
                window.removeEventListener('message', onPostMessage)
            }
        }
    }, [isLoading, kycStep, kycLinkId, kycLink, tosLink, onPostMessage])

    const onTosLinkLoaded = () => {
        analytics.track('tosLinkLoaded')
    }

    const onKycLinkLoaded = () => {
        analytics.track('kycLinkLoaded')
    }

    const onPlaidSuccess = async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
        try {
            // res.cardAccounts, res.errors = [string, string]
            const publicTokenExchangeRes = await POST('/api/plaid/exchange-token', { kycLinkId, linkToken, publicToken, metadata })

            // somewhat misnamed. plaid worked, but the account adds may not
            analytics.track('onPlaidSuccess', { linkToken, publicToken, metadata })
            if (publicTokenExchangeRes.data?.errors?.length) {
                triggerChatSupportError(publicTokenExchangeRes.data?.errors, smartWalletAddress)
                toast.error('An error occurred while connecting this account.')
            } else {
                // refresh the card accounts
                // note that multiple accounts can be returned
                refreshCardAccounts()

                // make sure we have session keys for the new accounts
                await updateSessionSigner()

                // FIXME take the user to the send money screen on that account
                toast.success('Account(s) connected successfully.')
            }
        } catch (error) {
            triggerChatSupportError(error, smartWalletAddress)
            toast.error('An error occurred while connecting this account.')
        }

        await router.push('/dashboard')
    }

    const onPlaidExit = async (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
        setKycStep(FlowStateStep.SelectAccountType)
        setKycLinkId(null)

        router.push('/dashboard')
        toast.error('Account connection cancelled.')
    }

    return (
        <>
            <div className={styles.container}>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    {kycStep === FlowStateStep.SelectAccountType && (
                        <div className="m-4">
                            <div className="absolute top-[18px] left-[22px] text-sm" onClick={() => router.push('/dashboard')}>
                                <IoMdClose size={20} />
                            </div>
                            <h3 className="text-2xl font-bold mb-4">Connect Account</h3>
                            <div className="mb-2 text-center">
                                <span>Where would you like to receive your money?</span>
                            </div>
                            {/* <button
                                className={'mb-2 btn btn-primary'}
                                onClick={() => {
                                    _loadBridgeAccounts()
                                    setKycStep(FlowStateStep.Tos)
                                }}>
                                US Bank Account
                            </button> */}
                            <button
                                className={'mb-2 btn btn-secondary'}
                                onClick={() => {
                                    setKycStep(FlowStateStep.ConnectWallet)
                                }}>
                                Wallet (e.g. MetaMask)
                            </button>
                            <button
                                className={'mb-2 btn btn-secondary'}
                                onClick={() => {
                                    setKycStep(FlowStateStep.ConnectExchange)
                                }}>
                                Exchange (e.g. Coinbase, Binance)
                            </button>
                        </div>
                    )}

                    {/* Wallet/Exchange states */}
                    {kycStep == FlowStateStep.ConnectWallet && (
                        <div className="m-4">
                            <div className="absolute top-[18px] left-[22px] text-sm" onClick={() => setKycStep(FlowStateStep.SelectAccountType)}>
                                <IoMdClose size={20} />
                            </div>
                            <h3>Connect Wallet</h3>
                            <div className="mb-4 text-center">
                                <span>Money will be sent to your wallet on Optimism.</span>
                            </div>
                            <div className="flex flex-col space-y-4">
                                <label htmlFor="walletNameInput" className="text-sm font-semibold">
                                    Enter a name (e.g. MetaMask, Trust, etc.):
                                </label>
                                <input
                                    id="walletNameInput"
                                    type="text"
                                    placeholder="My Favorite Wallet"
                                    value={walletName}
                                    onChange={(e) => setWalletName(e.target.value)}
                                />
                                <label htmlFor="walletAddressInput" className="text-sm font-semibold">
                                    Enter the ETH address for your wallet (e.g. 0x...):
                                </label>
                                <input
                                    id="walletAddressInput"
                                    type="text"
                                    placeholder="0x..."
                                    value={walletAddress} // Uncomment and use state variable
                                    onChange={(e) => setWalletAddress(e.target.value)} // Uncomment and use state handler
                                />
                            </div>
                            <button
                                disabled={isSaving.current || walletName.length === 0 || walletAddress.length === 0 || walletAddress.length !== 42}
                                className={'mt-4 mb-2 btn btn-primary'}
                                onClick={async () => {
                                    console.log('isSaving', isSaving.current)
                                    if (isSaving.current) return

                                    isSaving.current = true
                                    const existingNames = new Set(cardAccounts.map((account) => account.name))
                                    console.log('existingNames', existingNames)
                                    if (existingNames.has(walletName)) {
                                        toast.error('Wallet name must be unique.')
                                    } else {
                                        log('Connect wallet', walletName, walletAddress)
                                        const res = await POST('/api/card-accounts/wallet', { walletName, walletAddress })
                                        console.log('res', res)
                                        if (res.data?.cardAccounts) {
                                            toast.success('Wallet connected successfully.')
                                            refreshCardAccounts()
                                            router.push('/dashboard')
                                        } else {
                                            toast.error(res.error || 'An error occurred while connecting this wallet.')
                                        }
                                    }
                                    isSaving.current = false
                                }}>
                                Connect
                            </button>
                        </div>
                    )}

                    {kycStep == FlowStateStep.ConnectExchange && (
                        <div className="m-4">
                            <div className="absolute top-[18px] left-[22px] text-sm" onClick={() => setKycStep(FlowStateStep.SelectAccountType)}>
                                <IoMdClose size={20} />
                            </div>
                            <h3>Connect Exchange</h3>
                            <div className="mb-4 text-center">
                                <span>Ensure that your exchange supports USDC on Optimism.</span>
                            </div>
                            <div className="flex flex-col space-y-4">
                                <label htmlFor="exchangeNameInput" className="text-sm font-semibold">
                                    Which exchange?
                                </label>
                                <select
                                    value={selectedExchangeType}
                                    onChange={(e) => setSelectedExchangeType(e.target.value)}
                                    className="form-multiselect block w-full mt-1">
                                    {getExchanges().map((x) => (
                                        <option key={x.value} value={x.value}>
                                            {x.displayName}
                                        </option>
                                    ))}
                                </select>

                                <label htmlFor="walletAddressInput" className="text-sm font-semibold">
                                    Enter the receive address for your exchange account (e.g. 0x...):
                                </label>
                                <input
                                    id="walletAddressInput"
                                    type="text"
                                    placeholder="0x..."
                                    value={walletAddress} // Uncomment and use state variable
                                    onChange={(e) => setWalletAddress(e.target.value)} // Uncomment and use state handler
                                />
                            </div>
                            <button
                                disabled={isSaving.current || walletAddress.length === 0 || walletAddress.length !== 42}
                                className={'mt-4 mb-2 btn btn-primary'}
                                onClick={async () => {
                                    isSaving.current = true
                                    log('Connect exchange', selectedExchangeType, walletAddress)
                                    const res = await POST('/api/card-accounts/wallet', { selectedExchangeType, walletAddress })
                                    console.log('res', res)
                                    if (res.data?.cardAccounts) {
                                        toast.success(`${getExchangeDisplayName(selectedExchangeType)} connected successfully.`)
                                        refreshCardAccounts()
                                        router.push('/dashboard')
                                    } else {
                                        toast.error(res.error || 'An error occurred while connecting this exchange.')
                                    }
                                    isSaving.current = false
                                }}>
                                Connect
                            </button>
                        </div>
                    )}

                    {/* Bank account states */}
                    {(kycStep === FlowStateStep.Tos || kycStep === FlowStateStep.Kyc) && (
                        <div>
                            <Link
                                className="text-sm text-center mx-auto block underline text-blue-600"
                                href="https://apidocs.bridge.xyz/docs/countries"
                                target="_blank"
                                rel="noopener noreferrer">
                                Bank accounts are not yet available in Alaska, Florida, Louisiana, and New York.
                            </Link>
                            {/* <div className="mb-2">
                                <p className="text-sm">
                                    Juniper's bank access is powered by{' '}
                                    <Link className="underline" href="https://bridge.xyz" target="_blank">
                                        Bridge
                                    </Link>
                                    . To add a bank account, you will need to accept their Terms of Service and verify your identity.
                                </p>
                            </div> */}
                        </div>
                    )}

                    {kycStep === FlowStateStep.Tos && tosLink && <iframe className={styles.tosIFrame} src={tosLink} onLoad={onTosLinkLoaded} />}

                    {kycStep === FlowStateStep.Kyc && kycLink && (
                        <iframe
                            className={styles.kycIFrame}
                            src={kycLink}
                            allow="camera;"
                            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
                            onLoad={onKycLinkLoaded}
                        />
                    )}

                    {kycStep === FlowStateStep.Plaid && (
                        <>
                            <LaunchLink token={linkToken} userId={user.id} onSuccess={onPlaidSuccess} onExit={onPlaidExit} />
                        </>
                    )}
                </motion.div>
            </div>
        </>
    )
}

function Skeleton() {
    return (
        <>
            <div className="w-full px-3 pb-3 flex-col space-y-4 items-center justify-between cursor-pointer animate-pulse">
                <div className="bg-stone-100 h-[900px] w-full" />
                <div className="bg-stone-200 h-3 w-2/3" />
                <div className="bg-stone-200 h-3 w-1/3" />
            </div>
        </>
    )
}
