/**
 * This page is loaded by Nextjs:
 *  - on the server, when data-fetching methods throw or reject
 *  - on the client, when `getInitialProps` throws or rejects
 *  - on the client, when a React lifecycle method throws or rejects, and it's
 *    caught by the built-in Nextjs error boundary
 *
 * See:
 *  - https://nextjs.org/docs/basic-features/data-fetching/overview
 *  - https://nextjs.org/docs/api-reference/data-fetching/get-initial-props
 *  - https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
 */

import * as Sentry from '@sentry/nextjs'
import Layout from '@/components/Reusable/Layout'
import styles from '@/styles/Home.module.css'

import { useContext, useEffect } from 'react'
import { userContext } from '@/context/user/userContext'
import Loading from '@/components/Reusable/Loading'

function Error({ statusCode }) {
    const { logout } = useContext(userContext)

    useEffect(() => {
        logout()
    }, [statusCode])

    return (
        <Layout>
            <div className={styles.container}>
                <Loading />
            </div>
        </Layout>
    )
}

Error.getInitialProps = async (contextData) => {
    const { res, err } = contextData
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404
    await Sentry.captureUnderscoreErrorException(contextData)
    return { statusCode }
}

export default Error
