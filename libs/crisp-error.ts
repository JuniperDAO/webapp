import { useContext } from 'react'
import { Crisp } from 'crisp-sdk-web'
import * as Sentry from '@sentry/nextjs'

export const triggerChatSupportError = (e, smartWalletAddress) => {
    Crisp.load()
    Crisp.chat.show()
    Crisp.message.send(
        'text',
        `An error occured: ${e.toString()}\nSCW ${smartWalletAddress}\nThis message has been forwarded to the development team who will respond shortly.`
    )

    Sentry.captureException(e)
}
