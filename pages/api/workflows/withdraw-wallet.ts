import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

import { completeIntent } from '@/libs/workflows'
import { getSessionSignerByOwnerId } from '@/libs/zerodev/server'
import { sendMailchimpTemplate, MailchimpSlugs } from '@/libs/mailchimp'

import { Network } from '@/libs/network/types'
import { ERC20Send } from '@/libs/send/ERC20Send'
import { getERC20Balance } from '@/libs/util/getERC20Balance'
import { log } from '@/libs/util/log'
import { toEth } from '@/libs/util/toEth'
import { txnsToUserOp } from '@/libs/zerodev'

import { AaveWithdraw } from '@/libs/withdraw/AaveWithdraw'
import { AAVE_SUPPLIABLE_ERC20_ADDRESSES, safeStringify } from '@/libs/constants'

export default async (req_, res_) => {
    if (req_.method === 'POST') {
        return await completeIntent(req_, res_, async function (req, res, intent) {
            const { destinationAddress } = req.body

            if (!destinationAddress) {
                return res.status(400).json({ error: `Missing destinationAddress ${destinationAddress}` })
            }

            const signer = await getSessionSignerByOwnerId(intent.ownerId)
            const address = await signer.getAddress()
            const user = await prisma.juniperUser.findUnique({
                where: {
                    id: intent.ownerId,
                },
            })
            if (!user || !signer) {
                return res_.status(404).json({ error: 'Not found' })
            }

            // sendMailchimpTemplate(user.email, MailchimpSlugs.WithdrawStarted, properties)

            const withdraw = new AaveWithdraw(signer)

            for (const [symbol, info] of Object.entries(AaveV3Optimism.ASSETS)) {
                if (AAVE_SUPPLIABLE_ERC20_ADDRESSES.get(symbol)) {
                    const balance = await getERC20Balance(address, Network.optimism, info.A_TOKEN)
                    if (balance.gt(0)) {
                        const preparedTxn = await withdraw.prepareWithdrawAll(symbol, info)
                        if (preparedTxn) {
                            const userOp = txnsToUserOp([preparedTxn])
                            log(`Withdrawing ${toEth(balance)} ${symbol} from Aave...`)
                            const wres = await signer.sendUserOperation(userOp)
                            log(`Withdrawal tx hash: ${safeStringify(wres)}`)
                        }
                    }
                }
            }

            const txids = {}
            for (const [symbol, info] of Object.entries(AaveV3Optimism.ASSETS)) {
                if (AAVE_SUPPLIABLE_ERC20_ADDRESSES.get(symbol) || symbol === 'USDC' || symbol === 'USDCn') {
                    const send = new ERC20Send(info.UNDERLYING, signer)
                    const newBalance = await getERC20Balance(address, Network.optimism, info.UNDERLYING)
                    if (newBalance.gt(0)) {
                        const preparedSendTxn = await send.prepareSend(newBalance, destinationAddress)
                        const txid = await signer.sendUserOperation(txnsToUserOp([preparedSendTxn]))
                        log(`Sent ${symbol} to withdrawAddress ${destinationAddress} txid ${txid}`)
                        txids[symbol] = txid
                    } else {
                        log(`No ${symbol} to send`)
                    }
                }
            }

            sendMailchimpTemplate(user.email, MailchimpSlugs.WithdrawCompleted, {
                smartContractWalletAddress: address,
                destinationAddress,
                ...txids,
            })
        })
    } else {
        return res_.status(405).json({ error: 'Method Not Allowed' })
    }
}
