import { Permission, ParamOperator, getPermissionFromABI } from '@zerodev/sdk'
import { AaveV3Optimism } from '@bgd-labs/aave-address-book'
import { TUNGSTEN_ACCOUNTS_RECEIVABLE } from '../constants'
import { parseAbi } from 'viem'

/**
 * This class handles creating permissions for a zero dev session key.
 * By setting these permissions, the session key has limited power such that
 * even if it is compromised, the user's funds are relatively safe.
 *
 * We allow the session key to
 * 1. Borrow from AAVE
 * 2. Send the borrowed token ONLY to the user's coinbase account
 *
 **/
export class SessionPermissions {
    receiveAddresses: string[]
    tokenToBorrowAddress: string

    constructor(addresses: string[], tokenToBorrowAddress: `0x${string}`) {
        this.receiveAddresses = addresses
        this.tokenToBorrowAddress = tokenToBorrowAddress
    }

    getAll(): Permission[] {
        let permissions = [this.aaveBorrowPermission(), this.sendToUsPermission()]

        this.receiveAddresses.map((address) => {
            if (address) {
                permissions.push(this._receiveAddressPermission(address))
            }
        })

        return permissions
    }

    // we allow the session key to borrow from AAVE
    // but we don't specify further parameters (which tokens. how much)
    // this would be difficult to do with aave because we are using their
    // L2 gas optimized functions that take encoded params rather than
    // separate arguments.
    aaveBorrowPermission(): Permission {
        return getPermissionFromABI({
            // Target contract to interact with
            target: AaveV3Optimism.POOL,
            // Maximum value that can be transferred.  In this case we
            // set it to zero so that no value transfer is possible.
            valueLimit: BigInt(0),
            // Contract abi
            abi: parseAbi(['function borrow(bytes32)']),
            // Function name
            functionName: 'borrow',
        })
    }

    _receiveAddressPermission(address: string): Permission {
        console.log(`_receiveAddressPermission: address: ${address}`)
        return getPermissionFromABI({
            // Target contract to interact with
            target: this.tokenToBorrowAddress as `0x${string}`,
            // Maximum value that can be transferred.  In this case we
            // set it to zero so that no value transfer is possible.
            valueLimit: BigInt(0),
            // Contract abi
            abi: parseAbi(['function transfer(address,uint256)']),
            // Function name
            functionName: 'transfer',
            // An array of conditions, each corresponding to an argument for
            // the function. No clue what is up with their type annotations
            // Type error: Type '[{ operator: ParamOperator.EQUAL; value: `0x${string}`; }]' is not assignable to type 'readonly [{ operator: ParamOperator; value: `0x${string}`; }, { operator: ParamOperator; value: bigint; }]'.
            // @ts-ignore
            args: [{ operator: ParamOperator.EQUAL, value: address }],
        })
    }

    sendToUsPermission(): Permission {
        return this._receiveAddressPermission(TUNGSTEN_ACCOUNTS_RECEIVABLE)
    }
}
