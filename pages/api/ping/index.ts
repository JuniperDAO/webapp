import prisma from '@/libs/prisma'
import { redis, redlock } from '@/libs/redis'

export default async (req, res) => {
    let count = 0
    let pong = 'ERR'

    let lock = await redlock.acquire(['ping'], 5000)
    try {
        count = await prisma.migrations.count()

        const r = redis()
        pong = await r.ping()
    } finally {
        res.status(count && pong ? 200 : 500).json({ count: count, ping: pong })

        await lock.release()
    }
}
