import { BigNumber, utils } from 'ethers'

export function toEth(wei: BigNumber) {
    return parseFloat(utils.formatEther(wei))
}

export function toWei(eth: string) {
    return utils.parseEther(eth)
}

// largely useful for display, in which if we round down, a user who
// deposits/repays some quantity will be short just a tiny amount
// ... of course this will fail at high /decimalPlaces/
export function toFixedCeil(num: number, decimalPlaces: number): string {
    let result = Math.ceil(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
    return result.toFixed(decimalPlaces)
}

export function toFixedFloor(num: number, decimalPlaces: number): string {
    let result = Math.floor(num * Math.pow(10, decimalPlaces)) / Math.pow(10, decimalPlaces)
    return result.toFixed(decimalPlaces)
}

export function bigMin(a: BigNumber, b: BigNumber): BigNumber {
    return a.lt(b) ? a : b
}

export function bigMax(a: BigNumber, b: BigNumber): BigNumber {
    return a.gt(b) ? a : b
}
