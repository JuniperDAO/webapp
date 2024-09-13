import { Intent } from '@prisma/client'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { executeIntent } from '@/libs/workflows'

export default async (req, res) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    if (req.method === 'POST') {
        const { destinationAddress } = req.body

        if (await executeIntent('withdraw-wallet', user.id, Intent.withdraw, { destinationAddress })) {
            res.status(200).json({
                error: false,
                destinationAddress,
            })
        } else {
            res.status(500).json({
                error: true,
                message: 'Withdraw failed',
            })
        }
    } else {
        res.status(400).json({
            error: true,
            message: 'bad verb',
        })
    }
}
