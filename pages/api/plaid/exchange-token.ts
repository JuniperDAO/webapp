import { BRIDGE_XYZ_API_URL, safeStringify } from '@/libs/constants'
import { v4 as uuidv4 } from 'uuid'
import prisma from '@/libs/prisma'
import { userFromTokenMiddleware } from '@/libs/userActions/validate'
import { getPlaidClient } from '@/libs/plaid/plaidConfig'
import { createExternalAccount, createLiquidationAddress, getExternalAccounts, getLiquidationAddresses, getOrCreateUserBridge } from '@/libs/bridge-xyz/api'

import * as Sentry from '@sentry/nextjs'
import { analytics } from '@/libs/evkv'
import axios from 'axios'

const _bankNameLast4Key = (name, last4) => {
    return `${name}-${last4}`
}

const _getExternalAccountsMap = async (customerId): Promise<Map<string, any>> => {
    let map = new Map<string, any>()
    const rc = await getExternalAccounts(customerId)
    console.log(rc)

    rc.data.map((account) => {
        const key = _bankNameLast4Key(account.account_name, account.last_4)
        console.log(`_getExternalAccountsMap: key: ${key}`)
        map.set(key, account)
    })
    console.log(`_getExternalAccountsMap: ${map}, ${map.size}`)

    return map
}

const _getLiquidationAddressesMap = async (customerId: string): Promise<Map<string, any>> => {
    // map is externalAccountId -> liquidationAddress
    let map = new Map<string, any>()
    const rc = await getLiquidationAddresses(customerId)
    console.log(rc)

    rc.data.map((address) => {
        map.set(address.external_account_id, address)
    })
    console.log(`_getLiquidationAddressesMap: ${map}, ${map.size}`)

    return map
}

export default async (req, res) => {
    const user = await userFromTokenMiddleware(req, res)
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (req.method === 'POST') {
        const { publicToken, linkToken, metadata } = req.body

        if (!publicToken) throw new Error(`Missing publicToken`)
        if (!linkToken) throw new Error(`Missing linkToken`)

        // https://plaid.com/docs/api/tokens/#itempublic_tokenexchange
        const plaidClient = getPlaidClient()
        const response = await plaidClient.itemPublicTokenExchange({
            public_token: publicToken,
        })
        const { access_token: accessToken, item_id: itemId, request_id: requestId } = response.data

        const toUpsert = { ownerId: user.id, accessToken, itemId, requestId }
        if (
            !(await prisma.userPlaidItem.upsert({
                where: { itemId },
                create: toUpsert,
                update: toUpsert,
            }))
        )
            throw new Error(`Failed to upsert UserPlaidItem`)

        // https://plaid.com/docs/api/products/auth/#authget
        const exch = await plaidClient.authGet({ access_token: accessToken })
        let { accounts, numbers } = exch.data

        // https://plaid.com/docs/api/products/identity/
        // ugly structure, e.g. > x = [{"addresses":[{"data":{"city":"SALT LAKE CITY","country":"US","postal_code":"84101","region":"UT","street":"877 S 200 W APT 200"},"primary":true}],"emails":[{"data":"dave+icloud@artichokelabs.com","primary":true,"type":"primary"}],"names":["David Young"],"phone_numbers":[{"data":"+14157126412","primary":true,"type":"other"}]}]
        let address
        let email = user.email
        let name
        let phone
        try {
            const identity = await plaidClient.identityGet({ access_token: accessToken })
            const identities = identity.data.accounts.flatMap((account) => account.owners)
            console.log(`identities: ${safeStringify(identities)}`)

            if (
                !(await prisma.userPlaidItem.update({
                    where: { itemId },
                    data: {
                        accounts: safeStringify(accounts),
                        numbers: safeStringify(numbers),
                        identities: safeStringify(identities),
                    },
                }))
            ) {
                throw new Error(`Failed to update UserPlaidItem Jsonb`)
            }

            // ugly structure, e.g. > x = [{"addresses":[{"data":{"city":"SALT LAKE CITY","country":"US","postal_code":"84101","region":"UT","street":"877 S 200 W APT 200"},"primary":true}],"emails":[{"data":"dave+icloud@artichokelabs.com","primary":true,"type":"primary"}],"names":["David Young"],"phone_numbers":[{"data":"+14157126412","primary":true,"type":"other"}]}]
            address = identities?.[0].addresses?.[0]?.data
            email = identities?.[0].emails?.[0]?.data
            name = identities?.[0].names?.[0]
            phone = identities?.[0].phone_numbers?.[0]?.data
        } catch (e) {
            console.error(`Failed to get identity for ${user.email}`, e)
            Sentry.captureException(e)
        }

        // we only want checking and savings accounts (i think?)
        // credit: Credit card
        // depository: Depository account
        // loan: Loan account
        // other: Non-specified account type

        // Possible values: 401a, 401k, 403B, 457b, 529, brokerage, cash isa, crypto exchange, education savings account, ebt, fixed annuity, gic, health reimbursement arrangement, hsa, isa, ira, lif, life insurance, lira, lrif, lrsp, non-custodial wallet, non-taxable brokerage account, other, other insurance, other annuity, prif, rdsp, resp, rlif, rrif, pension, profit sharing plan, retirement, roth, roth 401k, rrsp, sep ira, simple ira, sipp, stock plan, thrift savings plan, tfsa, trust, ugma, utma, variable annuity, credit card, paypal, cd, checking, savings, money market, prepaid, auto, business, commercial, construction, consumer, home equity, loan, mortgage, overdraft, line of credit, student, cash management, keogh, mutual fund, recurring, rewards, safe deposit, sarsep, payroll, null

        const numbersMap = new Map<string, any>()
        numbers['ach']?.map((number) => {
            numbersMap.set(number.account_id, number)
        })

        // if it has a roouting/account pair, we want it
        accounts = accounts.filter((account) => numbersMap.get(account.account_id))

        const userBridge = await getOrCreateUserBridge(user.email, user.id)
        console.log(`${user.email} userBridge: ${safeStringify(userBridge)}`)

        // ... check for dupes, maybe remove this later
        const externalAccountsMap = await _getExternalAccountsMap(userBridge.customerId)
        console.log(`externalAccountsMap for ${userBridge.customerId}: ${externalAccountsMap}, ${externalAccountsMap.size}`)

        // return any cardAccounts created for this FI
        const cardAccounts = []
        const errors = []

        // FIXME: bridge can't handle this in parallel
        // await Promise.all(...)
        for (const account of accounts) {
            const n = numbersMap.get(account.account_id)
            const userBankAccount = {
                ownerId: user.id,
                plaidAccountId: account.account_id,
                plaidItemId: itemId,
                account: n.account,
                routing: n.routing,
                wireRouting: n.wire_routing,
                mask: account.mask,
                name: account.name,
                officialName: account.official_name,
                subtype: account.subtype,
                type: account.type,
            }
            if (
                !(await prisma.userBankAccount.upsert({
                    where: { plaidAccountId: account.account_id },
                    create: userBankAccount,
                    update: userBankAccount,
                }))
            )
                throw new Error(`Failed to upsert UserBankAccount`)

            ///
            let externalAccountId: string
            const last4Key = _bankNameLast4Key(userBankAccount.name, userBankAccount.mask)
            console.log(`checking external accounts map for ${last4Key}`)
            const existingExternalAccount = externalAccountsMap.get(last4Key)
            if (existingExternalAccount) {
                console.log('found existing external account', existingExternalAccount.id)
                externalAccountId = existingExternalAccount.id
            } else {
                let externalAccount = {
                    type: 'raw',
                    bank_name: userBankAccount.name,
                    account_number: userBankAccount.account,
                    routing_number: userBankAccount.routing,
                    account_name: userBankAccount.name,
                    account_owner_name: name || user.id,
                    active: true,
                    address: undefined,
                }
                if (address) {
                    externalAccount.address = {
                        street_line_1: stripTrailingCommasAndSpaces(address.street),
                        // 	street_line_2: 'Apt 2F',
                        city: address.city,
                        state: address.region,
                        postal_code: address.postal_code,
                        // plaid says US, bridge says USA
                        // FIXME convert 2 letter ISO codes to 3 letter ISO codes
                        country: convertCountry(address.country),
                    }
                }
                console.log(`creating new externalAccount: ${safeStringify(externalAccount)}`)
                const externalAccountRc = await createExternalAccount(userBridge.customerId, externalAccount)
                if (externalAccountRc) {
                    externalAccountId = externalAccountRc.id
                } else {
                    errors.push(`Failed to create externalAccount for ${userBankAccount.name} ${userBankAccount.account}`)
                }
            }

            //
            const liquidationAddressesMap = await _getLiquidationAddressesMap(userBridge.customerId)
            let liquidationAddressRc = liquidationAddressesMap.get(externalAccountId)
            if (!liquidationAddressRc) {
                console.log(`creating new liquidationAddress for externalAccountId: ${externalAccountId}`)
                liquidationAddressRc = await createLiquidationAddress(userBridge.customerId, { external_account_id: externalAccountId })
            } else {
                console.log(`found existing liquidationAddress ${liquidationAddressRc} for externalAccountId: ${externalAccountId}`)
            }

            // why not upsert?
            let cardAccount = await prisma.cardAccount.findFirst({
                where: {
                    customerId: userBridge.customerId,
                    externalAccountId: externalAccountId,
                },
            })
            if (cardAccount) {
                console.log(`found existing cardAccount ${cardAccount.id} for externalAccountId: ${externalAccountId}`)
            } else {
                // create the cardAccount record so we can send funds to it
                // liquidation_address create 201 {
                // 	id: 'd7a3b0c5-ecac-451f-9022-273b52feb4f3',
                // 	chain: 'optimism',
                // 	address: '0x103c129ab6d8ccf4e1937d2c2482274940063006',
                // 	currency: 'usdc',
                // 	external_account_id: '512442e1-cb3e-47fe-b53d-0a3d242e362f',
                // 	destination_payment_rail: 'ach',
                // 	destination_currency: 'usd',
                // 	created_at: '2024-01-25T22:07:22.905Z',
                // 	updated_at: '2024-01-25T22:07:22.905Z'
                //   }
                // the last case to handle here would be where there is all of this bridge structure but no cardAccount
                cardAccount = await prisma.cardAccount.create({
                    data: {
                        ownerId: user.id,
                        provider: 'bridge',
                        externalAccountId: externalAccountId,
                        customerId: userBridge.customerId,
                        address: liquidationAddressRc.address.toLowerCase(),
                        liquidationAddressId: liquidationAddressRc.id,
                        plaidItemId: itemId,
                        plaidAccessToken: accessToken,

                        last4: account.mask,
                        name: account.official_name,
                        bankName: account.name,
                    },
                })
            }

            cardAccounts.push(cardAccount)
        }

        res.status(200).json({ cardAccounts, errors })
    } else {
        return res.status(405).json({ error: 'Method Not Allowed' })
    }
}

const convertCountry = (country: string) => {
    if (!country || country === 'US') {
        return 'USA'
    }

    throw new Error(`Invalid country code ${country}`)
}

function stripTrailingCommasAndSpaces(str: string): string {
    if (!str) return str
    return str.replace(/,\s*$/, '')
}
