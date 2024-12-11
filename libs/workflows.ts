import prisma from '@/libs/prisma'
import {
    DEFERRED_EXECUTION_BASE_URI,
    DEFERRED_EXECUTION_SECRET,
    DEFERRED_EXECUTION_WORKFLOW_NAME,
    IS_PRODUCTION,
    GCP_LOCATION,
    GCP_PROJECT_ID,
    safeStringify,
} from '@/libs/constants'
import { log } from '@/libs/util/log'
import * as Sentry from '@sentry/nextjs'
import { redlock } from '@/libs/redis'
import { Intent } from '@prisma/client'

import { EtherscanTransfersClient } from '@/libs/transactionHistory/EtherscanTransfersClient'

export const INTENT_CRASH_REDLOCK_MS = 600 * 1000

export async function executeIntent(workflow: string, ownerId: string, intentType: Intent, params: any) {
    // for debugging:
    // get ngrok, set that up
    // set DEFERRED_EXECUTION_BASE_URI = 'https://your-ngrok-id.ngrok.io'
    // gcloud workflows deploy httpPostRetry-${you, e.g. dave} --source ops/workflows/httpPostRetry.yaml
    const executionsClient = new ExecutionsClient()
    const url = `${DEFERRED_EXECUTION_BASE_URI}/api/workflows/${workflow}`
    const args = {
        maxRetries: IS_PRODUCTION ? 10 : 3,
        sleepTime: IS_PRODUCTION ? 300 : 30,
        maxSleep: IS_PRODUCTION ? 3600 : 60,
        url: url,
        postData: {
            secret: DEFERRED_EXECUTION_SECRET,
            intentId: '',
            ...params,
        },
    }

    const intent = await prisma.userIntent.create({
        data: {
            ownerId,
            intentType,
            intentData: JSON.stringify(params),
        },
    })
    log(`Created intent: ${safeStringify(intent)}`)
    args.postData.intentId = intent.id

    try {
        log(`Creating execution on ${DEFERRED_EXECUTION_WORKFLOW_NAME} with URL ${url} args: ${safeStringify(args)}`)
        const createExecutionRes = await executionsClient.createExecution({
            parent: executionsClient.workflowPath(GCP_PROJECT_ID, GCP_LOCATION, DEFERRED_EXECUTION_WORKFLOW_NAME),
            execution: {
                argument: JSON.stringify(args),
            },
        })
        log(`Created execution on ${DEFERRED_EXECUTION_WORKFLOW_NAME}: ${safeStringify(createExecutionRes)}`)
        return createExecutionRes
    } catch (e) {
        Sentry.captureException(e)
        log(`Error executing workflow: ${e}`)
        return null
    }
}

export async function completeIntent(req, res, fn) {
    try {
        let intent = null
        const { secret, intentId } = req.body
        if (secret !== DEFERRED_EXECUTION_SECRET) {
            return res.status(403).json({ error: 'Unauthorized' })
        }

        intent = await prisma.userIntent.findUnique({
            where: {
                id: intentId,
            },
        })
        log(`${intentId} found: ${safeStringify(intent)}`)
        if (intent.completedAt) {
            log(`${intent.id} intent already completed`)
            // A body was attempted to be set with a 204 statusCode for /api/workflows/add-funds, this is invalid and the body was ignored.
            // See more info here https://nextjs.org/docs/messages/invalid-api-status-body
            return res.status(204).end()
        }

        const wallet = await prisma.userSmartWallet.findFirst({
            where: {
                ownerId: intent.ownerId,
            },
        })
        if (!wallet) {
            throw new Error(`No wallet found for user ${intent.ownerId}`)
        }

        return await redlock
            .using([wallet.smartContractWalletAddress, intentId], INTENT_CRASH_REDLOCK_MS, async function (signal) {
                // redlock peculiarties
                if (signal.aborted) {
                    throw signal.error
                }

                // let's assume any errors in this block are blockchain related
                try {
                    await fn(req, res, intent)

                    // mark the intent as completed
                    await prisma.userIntent.update({
                        where: {
                            id: intentId,
                        },
                        data: {
                            completedAt: new Date(),
                        },
                    })

                    log(`${intent.id} intent completed at ${new Date()}`)
                } catch (e) {
                    log(`${intent.id} error`, e)
                    Sentry.captureException(e)
                    return res.status(503).json({ error: e.toString() })
                }

                return res.status(200).json({ message: `Intent completed`, intentId })
            })
            .then(() => {
                // The code here runs after the lock is successfully released
                if (intent) {
                    prisma.userSmartWallet
                        .findMany({
                            where: {
                                ownerId: intent.ownerId,
                            },
                        })
                        .then((userSmartWallets) => {
                            userSmartWallets.forEach((userSmartWallet) => {
                                const client = new EtherscanTransfersClient({ address: userSmartWallet.smartContractWalletAddress })
                                client.invalidateTransfersCache()
                            })
                        })
                }
            })
            .catch((e) => {
                // Handle the error of acquiring the lock or any errors within the lock
                Sentry.captureException(e)
                log(`${intentId} Intent failed to acquire or maintain the lock:`, e)
                return res.status(423).json({ error: e.toString() })
            })
    } catch (e) {
        Sentry.captureException(e)
        log(`Error completing intent ${safeStringify(req.body)}: ${e}`)
        return res.status(503).json({ error: e.toString() })
    }
}
