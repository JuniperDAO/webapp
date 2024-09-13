import { useState } from 'react'
import styles from '@/styles/Verify.module.css'
import Layout from '@/components/Reusable/Layout'
import OtpInput from 'react-otp-input'
import { useRouter } from 'next/router'
import { motion } from 'framer-motion'
import { page } from '@/libs/animate'

export default function Verify() {
    const [otp, setOtp] = useState('')
    const router = useRouter()

    return (
        <Layout>
            <div className={styles.container}>
                <motion.div initial="initial" animate="animate" exit="exit" variants={page} className={styles.content}>
                    <div className={styles.form}>
                        <h3>Enter your Verification Code</h3>
                        <p>
                            Enter the code we have sent to <strong>coding.harshp@gmail.com</strong>
                        </p>
                        <OtpInput
                            value={otp}
                            onChange={setOtp}
                            numInputs={4}
                            inputType="number"
                            containerStyle={styles.otp}
                            inputStyle={styles.otpInput}
                            renderInput={(props) => (
                                <span className={styles.inputWrapper}>
                                    <input {...props} />
                                </span>
                            )}
                        />
                        <a href="#">Re-send Code</a>
                    </div>
                    <div className={styles.cta}>
                        <button onClick={() => router.push('/dashboard/fund-account')} type="submit" className="btn btn-primary">
                            Verify My Email
                        </button>
                        <button onClick={() => router.push('/email')} type="button" className="btn btn-secondary">
                            Back
                        </button>
                    </div>
                </motion.div>
            </div>
        </Layout>
    )
}
