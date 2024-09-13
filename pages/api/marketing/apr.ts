import axios from 'axios'
import util from 'util'
import { redis } from '@/libs/redis'

const DUNE_COMBINED_QUERY_NUMBER = '2978003'

async function dune(queryNumber) {
    const rd = redis()
    const apiKey = process.env.DUNE_API_KEY
    const url = `https://api.dune.com/api/v1/query/${queryNumber}/results?api_key=${apiKey}`
    const cacheKey = `duneQuery-${queryNumber}`

    // Check if the result is already cached in Redis
    const cachedResult = await rd.get(cacheKey)
    if (cachedResult) {
        return JSON.parse(cachedResult)
    }

    const response = await axios.get(url)
    const result = response.data

    // Cache the result in Redis with a TTL of 86400 seconds (24 hours)
    await rd.set(cacheKey, JSON.stringify(result), 'EX', 86400)

    return result
}

export default async function handler(req, res) {
    const rc = await dune(DUNE_COMBINED_QUERY_NUMBER)

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.json(rc.result.rows[0])
}
