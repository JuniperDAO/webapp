import { userFromTokenMiddleware } from '@/libs/userActions/validate'

export default async function test(req, res) {
    const userInformation = await userFromTokenMiddleware(req, res)
    if (!userInformation) return
    // check if userInformation is valid
    try {
        res.status(200).json({ success: true })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}
