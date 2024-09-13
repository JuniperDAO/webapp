import { Intent } from '@prisma/client'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { executeIntent } from '@/libs/workflows'

export default async (req, res) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'POST') {
        const { amount, symbol, smartWalletAddress } = req.body

        if (await executeIntent('add-funds', user.id, Intent.deposit, { amount, symbol, smartWalletAddress })) {
            res.status(200).json({
                error: false,
            })
        } else {
            res.status(500).json({
                error: true,
                message: 'Deposit failed',
            })
        }
    } else {
        res.status(400).json({
            error: true,
            message: 'bad verb',
        })
    }
}
