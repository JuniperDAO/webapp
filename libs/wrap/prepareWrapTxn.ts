import { BigNumberish, Signer, ethers } from 'ethers'
import abi from './WethAbi'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'

export async function prepareWrapTxn(amountToWrapWei: BigNumberish) {
    const wethContract = new ethers.Contract(AaveV3Optimism.ASSETS.WETH.UNDERLYING, abi)

    const txn = await wethContract.populateTransaction.deposit({
        value: amountToWrapWei,
    })

    return txn
}
