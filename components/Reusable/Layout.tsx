import React from 'react'
import styles from '@/styles/Layout.module.css'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { staticURL } from '@/libs/constants'

type LayoutProps = {
    title?: string
    children: React.ReactNode
    backgroundImageUrl?: string
}

export default function Layout({ title = 'Juniper', children, backgroundImageUrl }: LayoutProps) {
    return (
        <div className={styles.container}>
            <Head>
                <title>{title}</title>
            </Head>

            {backgroundImageUrl ? (
                <motion.div layoutId="background">
                    <img className={styles.background} src={backgroundImageUrl} alt="Background Image" />
                </motion.div>
            ) : null}

            <div className={styles.content}>
                <div className={styles.main}>
                    <div className={styles.children}>{children}</div>
                </div>
            </div>
        </div>
    )
}
