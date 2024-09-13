import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import prisma from '@/libs/prisma'
import { SMART_WALLET_VERSION } from '@/libs/constants'
import { log, redactKey } from '@/libs/util/log'

export default async function _(req, res) {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) return res.status(404).json({ error: 'User not found' })

    const { address, sessionKey, network } = req.body

    const networkToUse = network || 'optimism'

    if (!address || !sessionKey) return res.status(400).json({ error: 'Missing address or sessionKey' })

    try {
        // const existingWallet = await prisma.userSmartWallet.findUnique({
        //     where: {
        //         network_smartContractWalletAddress: {
        //             network: networkToUse,
        //             smartContractWalletAddress: address,
        //         },
        //     },
        // })
        // if (existingWallet) {
        //     const scrubbedWallet = { ...existingWallet, sessionKey: formatAddress(existingWallet.sessionKey, 20, 20) }
        //     console.log(`existingWallet: ${JSON.stringify(scrubbedWallet)}`)
        // }

        await prisma.userSmartWallet.upsert({
            where: {
                network_smartContractWalletAddress: {
                    network: networkToUse,
                    smartContractWalletAddress: address,
                },
            },
            update: {
                sessionKey,
                sessionKeyUpdatedAt: new Date(),
                version: SMART_WALLET_VERSION,
                updatedAt: new Date(),
            },
            create: {
                smartContractWalletAddress: address,
                sessionKey,
                sessionKeyUpdatedAt: new Date(),
                network: networkToUse,
                ownerId: user.id,
                version: SMART_WALLET_VERSION,
            },
        })

        log(
            `Saved wallet for user ${
                user.id
            } on network ${networkToUse} with address ${address}, version ${SMART_WALLET_VERSION} and sessionKey ${redactKey(sessionKey)}`
        )

        res.status(200).json({ success: true, address })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}
