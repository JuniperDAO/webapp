import styles from '@/styles/BridgeConnect.module.css'
import { useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { createAndSaveSessionSigner } from '@/libs/zerodev'
import { usePrivySmartAccount } from '@zerodev/privy'
import { toast } from 'sonner'
import { IS_PRODUCTION } from '@/libs/constants'
import { IoMdClose } from 'react-icons/io'
import { page } from '@/libs/animate'
import { motion } from 'framer-motion'

// http://localhost:3000/bridge/callback?signed_agreement_id=efd26651-01af-4412-b7d0-ffed5181ffb6
const Callback = () => {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()
    const { zeroDevReady, getEthereumProvider } = usePrivySmartAccount()

    const onClose = () => {
        router.push('/dashboard')
    }

    useEffect(() => {
        // wait for zerodev to be ready so we can create a session signer
        if (!zeroDevReady) return

        async function verify() {
            // ...
            const { signed_agreement_id } = router.query
            if (!signed_agreement_id) return

            // // create and save a zero dev session signer
            // const provider = await getEthereumProvider()

            // await createAndSaveSessionSigner(provider)

            // await router.push('/dashboard')
        }

        verify().catch((e) => {
            console.log('THE ERROR VERIFYING WAS: ', e)
            toast.error(IS_PRODUCTION ? 'Failed to connect, please try again' : e.toString(), {
                position: 'top-center',
            })

            router.push('/connect')
        })
    }, [router.query, zeroDevReady, getEthereumProvider])

    // see also https://docs.mapbox.com/mapbox-search-js/tutorials/add-address-autofill-with-react/
    return (
        <div className={styles.container}>
            <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                <div onClick={onClose}>
                    <IoMdClose size={20} />
                </div>

                <h3>Your Bank Account: Details</h3>
            </motion.div>
        </div>
    )
}

export default Callback
