import styles from '@/styles/signin.module.css'
import Layout from '@/components/Reusable/Layout'
import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

import { usePrivy } from '@privy-io/react-auth'
import { Crisp } from 'crisp-sdk-web'
import { staticURL } from '@/libs/constants'
import { set } from 'date-fns'

export default function SignIn() {
    const [showingLogin, setShowingLogin] = useState<boolean>(false)
    const router = useRouter()
    const { ready, authenticated, user, login } = usePrivy()

    useEffect(() => {
        Crisp.chat.show()

        if (!ready) return

        if (!authenticated) {
            if (!showingLogin) {
                login()
                setShowingLogin(true)
                Crisp.chat.show()
            }
        } else {
            router.replace('/dashboard')
        }
    }, [ready, authenticated, login])

    return (
        <Layout backgroundImageUrl={staticURL('/public/images/background.png')}>
            <div className={styles.container}></div>
        </Layout>
    )
}
