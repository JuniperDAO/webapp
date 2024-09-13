// pages/api/averageDailyBalance.ts

import { NextApiRequest, NextApiResponse } from 'next'
import { EtherscanTransfersClient } from '@/libs/transactionHistory/EtherscanTransfersClient'
import { log } from '@/libs/util/log'
import { DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS } from '@/libs/constants'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { address, trailingDays = DAILY_BALANCE_TRANSACTION_LOOKBACK_DAYS } = req.query
    const apiKey = req.headers['x-api-key']

    if (process.env.API_KEY === undefined) {
        throw new Error('API_KEY is not defined')
    }

    if (apiKey !== process.env.API_KEY) {
        log(process.env.API_KEY)
        return res.status(403).json({ error: 'Forbidden' })
    }

    if (!address) {
        return res.status(400).json({ error: 'Address is required' })
    }

    const client = new EtherscanTransfersClient({ address: address as string })

    try {
        const balance = await client.getAverageDailyBalance(Number(trailingDays))
        res.status(200).json({ balance })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}
