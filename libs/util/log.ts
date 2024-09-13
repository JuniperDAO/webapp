import { analytics } from '@/libs/evkv'
import { IS_PRODUCTION, safeStringify } from '@/libs/constants'
import { ethers } from 'ethers'

export function log(...args: any[]) {
    // skip logging during tests
    if (process.env.NODE_ENV === 'test') return

    // try {
    //     // we know some objects from `viem` can't be stringified
    //     const jsonified = args.map((x) => safeStringify(x))

    //     analytics.track('log', { args: jsonified })
    // } catch (ex) {
    //     analytics.track('logError', { error: ex.toString() })
    // }

    const allArgs = ['jnpr>', ...args]
    console.log(...allArgs)
}

export function redact(str, prefix = 4, postfix = 4, hash = false) {
    if (hash) {
        const md5Hash = ethers.utils.id(str)
        return `[hashed ${str.substring(0, prefix)}...${md5Hash}...${str.slice(-postfix)}]`
    }
    if (str.length > prefix + postfix) {
        return `${str.substring(0, prefix)}...${str.slice(-postfix)}`
    } else {
        return '<REDACTED>'
    }

    return str
}

export const redactKey = (key: string): string => {
    return redact(key, 4, 4, true)
}
