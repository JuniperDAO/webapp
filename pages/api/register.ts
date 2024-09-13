import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { analytics } from '@/libs/evkv'

export default async function login(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

    const { referredBy, smartWalletAddress } = req.body
    const user = await userFromTokenMiddleware(req, res, { referredBy: referredBy })

    if (user) {
        analytics.track('register', { userInformation: user, smartWalletAddress: smartWalletAddress })

        return res.status(200).json({
            authenticated: true,
            error: false,
            user: user,
        })
    } else {
        return res.status(401).json({ error: 'Unauthorized' })
    }
}
