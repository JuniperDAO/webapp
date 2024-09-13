export type OnboardingStatus = {
    hasConnectedCard: boolean
    hasSmartWallet: boolean
    hasFundedAccount: boolean
}

export const defaultOnboardingStatus: OnboardingStatus = {
    hasConnectedCard: false,
    hasSmartWallet: false,
    hasFundedAccount: false,
}
