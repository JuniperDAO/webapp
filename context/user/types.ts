import { CardAccount, UserSmartWallet } from '@prisma/client'

export type JuniperUser = {
    id: string
    createdAt: Date
    updatedAt: Date
    did?: string
    deletedAt?: Date
    email?: string
    eoaWalletAddress?: string
    name?: string
    phoneNumber?: string
    // referrals
    referralCode?: string
    referredBy?: string
    // bank accounts
    kycLinkId?: string
    signedAgreementId?: string
    bridgeCustomerId?: string
    // relations
    smartWallets?: UserSmartWallet[]
    cardAccounts?: CardAccount[]
}

export type JuniperSmartWallet = {
    network: string
    smartContractWalletAddress: string
    version: number
}
