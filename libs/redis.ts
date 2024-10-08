import { Redis } from 'ioredis'
import { REDIS_URL } from '@/libs/constants'

import Redlock from 'redlock'

export const redis = () => {
    return new Redis(REDIS_URL) // stop saying redis
}

const _redlockRedis = redis()
export const redlock = new Redlock(
    // You should have one client for each independent redis node
    // or cluster.
    [_redlockRedis],
    {
        // The expected clock drift; for more details see:
        // http://redis.io/topics/distlock
        driftFactor: 0.01, // multiplied by lock ttl to determine drift time

        // The max number of times Redlock will attempt to lock a resource
        // before erroring.
        retryCount: 10,

        // the time in ms between attempts
        retryDelay: 1000, // time in ms

        // the max time in ms randomly added to retries
        // to improve performance under high contention
        // see https://www.awsarchitectureblog.com/2015/03/backoff.html
        retryJitter: 200, // time in ms

        // The minimum remaining time on a lock before an extension is automatically
        // attempted with the `using` API.
        automaticExtensionThreshold: 500, // time in ms
    }
)
