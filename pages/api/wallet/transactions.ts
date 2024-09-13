import { EtherscanTransfersClient } from '@/libs/transactionHistory/EtherscanTransfersClient'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { JuniperTransaction, JuniperTransactionType } from '@/libs/transactionHistory/types'
import { Intent } from '@prisma/client'

export default async function handler(req, res) {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    // TODO assert this is the same as the user
    const { smartWalletAddress, page } = req.query

    const cardAccounts = await prisma.cardAccount.findMany({
        where: {
            ownerId: user.id,
        },
    })
    const cardAccountMap = new Map<string, string>()
    cardAccounts.forEach((cardAccount) => {
        cardAccountMap.set(cardAccount.id, cardAccount.address)
    })

    const intentToTxn = (intent: any): JuniperTransaction | null => {
        const data = JSON.parse(intent.intentData)
        const txn: JuniperTransaction = {
            type: JuniperTransactionType.Repay,
            amount: 0,
            from: smartWalletAddress,
            to: smartWalletAddress,
            date: intent.updatedAt,
            transactionHash: `intent-${intent.id}`,
            currency: null,
        }
        if (intent.intentType === Intent.borrow_and_send) {
            txn.type = JuniperTransactionType.Spend
            txn.amount = data.desiredSpendingPowerUSD
            txn.to = cardAccountMap.get(data.cardAccountId)
            txn.currency = 'USDC'
        } else if (intent.intentType === Intent.deposit) {
            txn.type = JuniperTransactionType.Deposit
        } else if (intent.intentType === Intent.repay) {
            txn.type = JuniperTransactionType.Repay
        } else if (intent.intentType === Intent.withdraw) {
            txn.type = JuniperTransactionType.Withdraw
        } else {
            console.log('Unknown intent type', intent)
            return null
        }

        return txn
    }

    if (!smartWalletAddress) {
        return res.status(200).json({
            transactions: [],
            nextPage: null,
        })
    } else {
        const client = new EtherscanTransfersClient({ address: smartWalletAddress })
        let data = await client.getTransferHistory(page)

        if (!page || page == 0) {
            const incompleteIntents = await prisma.userIntent.findMany({
                where: {
                    ownerId: user.id,
                    completedAt: null,
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })
            const txns = incompleteIntents.map(intentToTxn).filter((txn) => txn !== null)

            data.transactions = [...txns, ...data.transactions]
            data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        }

        return res.status(200).json(data)
    }
}
