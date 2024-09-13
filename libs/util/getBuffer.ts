import { ethers } from 'ethers'

export const getBuffer = (gasPrice: ethers.BigNumber, percent: number = 10) => {
    return gasPrice.mul(100 + percent).div(100)
}
