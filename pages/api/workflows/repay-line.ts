import { log } from '@/libs/util/log'
import { AAVE_SUPPORTED_STABLES, safeStringify } from '@/libs/constants'
import { analytics } from '@/libs/evkv'

import { completeIntent } from '@/libs/workflows'
import { getSessionSignerByOwnerId } from '@/libs/zerodev/server'
import { sendMailchimpTemplate, MailchimpSlugs } from '@/libs/mailchimp'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { AaveRepay } from '@/libs/repay/AaveRepay'
import { bigMin, toEth } from '@/libs/util/toEth'
import { txnsToUserOp } from '@/libs/zerodev'
import { getERC20Balance, getAllStableBalances } from '@/libs/util/getERC20Balance'
import { Network } from '@/libs/network/types'
import { swapStablesForStable } from '@/libs/lineRepayment/swapERC20'
import { AaveLoanInfo } from '@/libs/borrow/AaveLoanInfo'

export default async (req_, res_) => {
    if (req_.method === 'POST') {
        return await completeIntent(req_, res_, async function (req, res, intent) {
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

            const loanInfo = new AaveLoanInfo(address)
            const accountInfo = await loanInfo.getAccountInfoWei()
            if (accountInfo.totalDebtWei.lte(0)) {
                log(`${address} has no debt to repay`)
                return res_.status(204).json({ error: 'Account is fully repaid' })
            }
            const stableBalance = await getAllStableBalances(address, Network.optimism)
            log(`${address} has ${stableBalance} of stables and ${accountInfo.totalDebtWei} of debt`)

            // sendMailchimpTemplate(user.email, MailchimpSlugs.RepayStarted, {
            //     smartContractWalletAddress: address,
            //     debtAmountUSD: toEth(accountInfo.totalDebtWei).toFixed(2),
            // })

            analytics.track('repayLine', { address, stableBalance, ...accountInfo })

            // XXX no longer support ETH repayments?
            // since we previously borrowed in Bridged USDC (e), and now use USDCn, we need to check each. Clear out the (e) debt first if possible. we only use variable debt, so V_TOKENs
            for (const symbol of ['USDC', 'USDCn']) {
                const asset = AaveV3Optimism.ASSETS[symbol]
                const debt = await getERC20Balance(address, Network.optimism, asset.V_TOKEN)

                if (debt.lte(0)) {
                    log(`${address} no debt for ${symbol}`)
                    continue
                }

                let balance = await getERC20Balance(address, Network.optimism, asset.UNDERLYING)
                log(`${address} debt: ${symbol}: ${debt}, balance: ${balance}`)

                if (balance.lt(debt)) {
                    log(`${address} swapping stables to get ${debt} of ${symbol} (have ${balance})`)
                    // the debt can be much more than the available stable balance
                    await swapStablesForStable(debt, signer, AAVE_SUPPORTED_STABLES, symbol)
                    balance = await getERC20Balance(address, Network.optimism, asset.UNDERLYING)
                } else {
                    log(`${address} have ${balance} of ${symbol} to repay of ${debt} debt, no swap`)
                }

                // afaict AaveRepay isn't stateful, but we still create a new one each time
                const aaveRepay = new AaveRepay(signer)
                if (balance.gt(0)) {
                    log(`${address} ${symbol} have ${balance} of ${debt} to repay`)
                    const { approvalTx, repayTx } = await aaveRepay.prepareRepay(asset.UNDERLYING, bigMin(balance, debt))

                    const approvalResponse = await signer.sendUserOperation(txnsToUserOp([approvalTx])[0])
                    log(`${address} approval to repay ${symbol}: ${safeStringify(approvalResponse)}`)

                    const repayResponse = await signer.sendUserOperation(txnsToUserOp([repayTx])[0])
                    log(`${address} repay response ${symbol}: ${safeStringify(repayResponse)}`)

                    analytics.track('repayLineResponse', { approvalResponse, repayResponse })
                } else {
                    log(`${address} ${symbol} have ${balance} of ${debt}, cannot repay`)
                }
            }

            sendMailchimpTemplate(user.email, MailchimpSlugs.RepayCompleted, {
                smartContractWalletAddress: address,
                debtAmountUSD: toEth(accountInfo.totalDebtWei).toFixed(2),
            })
        })
    } else {
        return res_.status(405).json({ error: 'Method Not Allowed' })
    }
}
