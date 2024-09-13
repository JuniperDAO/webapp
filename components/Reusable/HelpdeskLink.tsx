import styles from '@/styles/HelpdeskLink.module.css'
import React from 'react'
import { IoIosHelpBuoy } from 'react-icons/io'
import { Crisp } from 'crisp-sdk-web'
import { analytics } from '@/libs/evkv'

interface HelpdeskLinkProps {
    slug: string
    text: string
}

export const HelpdeskLink = ({ slug, text }: HelpdeskLinkProps) => {
    const openHelpdesk = () => {
        analytics.track('helpdeskLinkClicked', { slug })

        Crisp.load()
        Crisp.chat.openHelpdeskArticle('en', slug)
    }

    return (
        <div className={styles.container}>
            <button onClick={openHelpdesk} className={styles.link}>
                <IoIosHelpBuoy size={20} />

                <p>{text}</p>
            </button>
        </div>
    )
}
