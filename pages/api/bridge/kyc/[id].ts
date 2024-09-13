import { BRIDGE_XYZ_API_URL } from '@/libs/constants'
import prisma from '@/libs/prisma'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { getPlaidClient } from '@/libs/plaid/plaidConfig'

import * as Sentry from '@sentry/nextjs'
import axios from 'axios'
import { v4 as uuidv4 } from 'uuid'
import { analytics } from '@/libs/evkv'

export default async (req, res) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const kycLinkId = req.query.id
    if (!kycLinkId) throw new Error(`Missing kycLinkId`)

    if (req.method === 'POST') {
        const { signedAgreementId } = req.body

        if (signedAgreementId) {
            const updatedRecord = await prisma.userBridge.update({
                data: {
                    signedAgreementId,
                },
                where: { id: kycLinkId },
            })
            if (!updatedRecord) throw new Error(`Record not found for kycLinkId: ${kycLinkId}`)
        }
    }

    // return the new KYC link object
    const response = await axios.get(`${BRIDGE_XYZ_API_URL}/v0/kyc_links/${kycLinkId}`, {
        headers: {
            'Api-Key': process.env.BRIDGE_XYZ_API_KEY,
        },
    })
    console.log('kyc link response', response.status, response.data)

    // check the returned object for customer_id and update our records if available
    // this stores the critical customer_id in our database
    const { customer_id: customerId } = response.data
    let updatedRecord = await prisma.userBridge.update({
        data: {
            customerId: customerId,
            fullName: response.data.full_name,
            type: response.data.type,
            kycLink: response.data.kyc_link,
            tosLink: response.data.tos_link,
            kycStatus: response.data.kyc_status,
            tosStatus: response.data.tos_status,
            createdAt: new Date(response.data.created_at),
        },
        where: { id: kycLinkId },
    })
    if (!updatedRecord) throw new Error(`Record not found for user: ${user.id}`)

    // client will key on response.data.customer_id to begin Plaid flow

    res.status(200).json(response.data)
}
