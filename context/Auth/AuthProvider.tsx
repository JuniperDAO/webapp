import { PrivyProvider } from '@privy-io/react-auth'
import { optimism, mainnet } from '@/libs/util/wagmiChains'

import { IS_PRODUCTION, staticURL } from '@/libs/constants'

export function AuthProvider({ children }) {
    if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
        throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID')
    }

    let privyConfig = {
        appearance: {
            logo: staticURL('/public/images/juniper-logo-wide.png'),
            showWalletLoginFirst: false,
            // showWalletLoginFirst: true,
            // theme: '#FFF7E7', // needs a new logo png if you want this
            accentColor: '#4B5443',
        },
        defaultChain: optimism,
        embeddedWallets: {
            createOnLogin: 'users-without-wallets',
            noPromptOnSignature: true,
        },
        loginMethods: ['apple', 'email', 'google'],
        supportedChains: [optimism, mainnet],
    }

    if (!IS_PRODUCTION) {
        privyConfig.appearance.logo = staticURL('/public/images/juniper-logo-wide-dev.png')
        privyConfig.loginMethods = ['wallet', 'apple', 'email', 'google']
    }

    return (
        <PrivyProvider appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID} config={privyConfig as any}>
            {children}
        </PrivyProvider>
    )
}
