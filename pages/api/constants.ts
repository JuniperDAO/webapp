import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import * as constants from '@/libs/constants'

export default async function test(req, res) {
    let rc = {
        NEXT_PUBLIC_BRANCH_NAME: process.env.NEXT_PUBLIC_BRANCH_NAME,
        NODE_ENV: process.env.NODE_ENV,
    }

    Object.entries(constants).map(([key, value]) => {
        rc[key] = value.toString()
    })

    res.status(200).json({ constants: rc })
}
