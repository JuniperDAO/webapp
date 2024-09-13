import { completeIntent } from '@/libs/workflows'
import { getSessionSignerByOwnerId } from '@/libs/zerodev/server'
import { wrapAndSwapForWSteth } from '@/libs/lineSetup/wrapAndSwapForWSteth'
import { depositAssetToAave } from '@/libs/lineSetup/depositWStethToAave'
import { getERC20Balance, getAllERC20Balances } from '@/libs/util/getERC20Balance'
import { log } from '@/libs/util/log'
import { Network } from '@/libs/network/types'
import { sendMailchimpTemplate, MailchimpSlugs } from '@/libs/mailchimp'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { safeStringify } from '@/libs/constants'

export default async (req_, res_) => {
    if (req_.method === 'POST') {
        return await completeIntent(req_, res_, async function (req, res, intent) {
            const signer = await getSessionSignerByOwnerId(intent.ownerId)
            const address = await signer.getAddress()
            const ethBalance = await signer.getBalance()
            const wethBalance = await getERC20Balance(address, Network.optimism, AaveV3Optimism.ASSETS.WETH.UNDERLYING)

            const user = await prisma.juniperUser.findUnique({
                where: {
                    id: intent.ownerId,
                },
            })

            if (!user || !signer || !address) {
                return res_.status(404).json({ error: 'Not found' })
            }

            if (ethBalance.gt(0) || wethBalance.gt(0)) {
                log(`${address} has ${ethBalance} ETH, ${wethBalance} WETH, swapping for wstETH`)
                await wrapAndSwapForWSteth(signer as any)
            } else {
                log(`${address} has no ETH, skipping wrap and swap`)
            }

            // getAllERC20Balances returns { contract-address: balance }
            const { balancesByContract, balancesBySymbol } = await getAllERC20Balances(address, Network.optimism)

            // only now do we know what we are depositing
            if (Object.keys(balancesBySymbol).length === 0) {
                log(`${address} is empty ${safeStringify(balancesBySymbol)}`)
                return res_.status(400).json({ error: 'No balances to deposit' })
            } else {
                log(`${address} has depositable tokens ${safeStringify(balancesBySymbol)}`)
            }

            // sendMailchimpTemplate(user.email, MailchimpSlugs.DepositStarted, {
            //     smartContractWalletAddress: address,
            //     ...balancesBySymbol,
            // })

            const { depositsBySymbol } = await depositAssetToAave(balancesByContract, signer)
            sendMailchimpTemplate(user.email, MailchimpSlugs.DepositCompleted, {
                smartContractWalletAddress: address,
                ...depositsBySymbol,
            })
        })
    } else {
        return res_.status(405).json({ error: 'Method Not Allowed' })
    }
}
