import React, { useEffect, useState } from 'react'
import {
    usePlaidLink,
    PlaidLinkOnSuccessMetadata,
    PlaidLinkOnExitMetadata,
    PlaidLinkError,
    PlaidLinkOptionsWithLinkToken,
    PlaidLinkOnEventMetadata,
    PlaidLinkStableEvent,
} from 'react-plaid-link'

import { analytics } from 'libs/evkv'

interface Props {
    userId: string // JNPR user.id
    token: string // link token, received from /api/plaid/link-token
    onSuccess: (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => void // onSuccess callback
    onExit: (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => void // onExit callback
    isOauth?: boolean // used internally to determine if it should open Link automatically
    itemId?: number | null // used internally during OAuth flow
    children?: React.ReactNode
}

// Uses the usePlaidLink hook to manage the Plaid Link creation.  See https://github.com/plaid/react-plaid-link for full usage instructions.
// The link token passed to usePlaidLink cannot be null.  It must be generated outside of this component.  In this sample app, the link token
// is generated in the link context in client/src/services/link.js.

export default function LaunchLink(props: Props) {
    // const { generateLinkToken, deleteLinkToken } = useLink()
    const [error, setError] = useState<null | any>(null)

    // define onSuccess, onExit and onEvent functions as configs for Plaid Link creation
    const onSuccess = async (publicToken: string, metadata: PlaidLinkOnSuccessMetadata) => {
        console.log(metadata, props.userId)
        analytics.track('plaidSuccess', metadata)

        props.onSuccess(publicToken, metadata)
        analytics.track('plaidSuccess', { error, ...metadata })
        setError(null)
    }

    const onExit = async (error: PlaidLinkError | null, metadata: PlaidLinkOnExitMetadata) => {
        console.log(error, metadata, props.userId)
        // it's possible for the link token to be invalid?  if so, example generates a new one and tries again
        setError(error || { error_code: 'JNPR_UNKNOWN_ERROR' })
        // to handle other error codes, see https://plaid.com/docs/errors/
        analytics.track('plaidExit', { error, ...metadata })
        props.onExit(error, metadata)
    }

    const onEvent = async (eventName: PlaidLinkStableEvent | string, metadata: PlaidLinkOnEventMetadata) => {
        // handle errors in the event end-user does not exit with onExit function error enabled.
        // DY: i don't know what that means
        if (eventName === 'ERROR' && metadata.error_code != null) {
            console.log('ERROR', metadata)
            setError(metadata)
        }
        console.log(eventName, metadata)
        analytics.track('plaidEvent', { eventName, ...metadata })
    }

    const config: PlaidLinkOptionsWithLinkToken = {
        onSuccess,
        onExit,
        onEvent,
        token: props.token,
    }

    if (props.isOauth) {
        config.receivedRedirectUri = window.location.href // add additional receivedRedirectUri config when handling an OAuth reidrect
    }

    const { open, ready } = usePlaidLink(config)

    useEffect(() => {
        // initiallizes Link automatically
        if (props.isOauth && ready) {
            open()
        } else if (ready) {
            // regular, non-OAuth case:
            // set link token, userId and itemId in local storage for use if needed later by OAuth

            localStorage.setItem(
                'oauthConfig',
                JSON.stringify({
                    userId: props.userId,
                    itemId: props.itemId,
                    token: props.token,
                })
            )
            open()
        }
    }, [ready, open, props.isOauth, props.userId, props.itemId, props.token])

    return <></>
}
