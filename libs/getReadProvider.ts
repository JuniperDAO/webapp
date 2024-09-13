import { Network } from '@/libs/network/types'
import { ethers } from 'ethers'

export const getReadProvider = (chain: Network) => {
    if (!process.env.NEXT_PUBLIC_QUICKNODE_URL) {
        throw new Error('NEXT_PUBLIC_QUICKNODE_URL is not set')
    }

    switch (chain) {
        case Network.optimism:
            return new ethers.providers.JsonRpcProvider(process.env.NEXT_PUBLIC_QUICKNODE_URL)
    }
    throw new Error(`Unsupported chain ${chain}`)
}

// export const getReadProvider = (chain: Network) => {
//     if (!process.env.NEXT_PUBLIC_INFURA_API_KEY) {
//         throw new Error('NEXT_PUBLIC_INFURA_API_KEY is not set')
//     }

//     switch (chain) {
//         case Network.optimism:
//         return new ethers.providers.JsonRpcProvider('https://optimism-mainnet.infura.io/v3/' + process.env.NEXT_PUBLIC_INFURA_API_KEY)
//     }

//     throw new Error(`Unsupported chain ${chain}`)
// }
