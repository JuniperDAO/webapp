import axios from 'axios'
import { BRIDGE_XYZ_API_URL, safeStringify } from '@/libs/constants'
import { v4 as uuidv4 } from 'uuid'
import * as Sentry from '@sentry/nextjs'
import { ca } from 'date-fns/locale'

const _SPECIAL_CASE_EMAILS = ['dave@tungstenfi.com']

class BridgeXYZError extends Error {
    public errorCode: number
    public data: any
    public axiosError: any

    constructor(message, errorCode, data, axiosError) {
        super(message) // Pass the message to the parent Error constructor
        this.name = this.constructor.name // Set the error's name to its class name
        this.errorCode = errorCode // Custom property to store the status code
        this.data = data // Custom property to store the response data
        this.axiosError = axiosError // Custom property to store the axios error

        // Maintaining proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor)
        }
    }
}

const printAsMuchAsPossible = (error: any) => {
    if (error.response) {
        // The server responded with a status code that falls out of the range of 2xx
        console.log('Error Response Data:', error.response.data)
        console.log('Error Response Status:', error.response.status)
        console.log('Error Response Headers:', error.response.headers)
    } else if (error.request) {
        // The request was made but no response was received
        console.log('Error Request:', error.request)
    } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error Message:', error.message)
    }
    console.log('Config:', error.config)
}

const _POST = async (method: string, data: any) => {
    const headers = {
        'Content-Type': 'application/json',
        'Api-Key': process.env.BRIDGE_XYZ_API_KEY,
        'Idempotency-Key': uuidv4(),
    }
    console.log(`POST ${BRIDGE_XYZ_API_URL}/v0/${method}`, data, { headers })
    try {
        const response = await axios.post(`${BRIDGE_XYZ_API_URL}/v0/${method}`, data, { headers })
        return response.data
    } catch (axiosError) {
        printAsMuchAsPossible(axiosError)
        throw new BridgeXYZError(`Error in _POST: ${safeStringify(axiosError.response.data)}`, axiosError.response.status, axiosError.response.data, axiosError)
    }
}

const _GET = async (method: string) => {
    const headers = {
        'Content-Type': 'application/json',
        'Api-Key': process.env.BRIDGE_XYZ_API_KEY,
    }
    console.log(`GET ${BRIDGE_XYZ_API_URL}/v0/${method}`, { headers })
    try {
        const response = await axios.get(`${BRIDGE_XYZ_API_URL}/v0/${method}`, {
            headers: headers,
        })
        return response.data
    } catch (axiosError) {
        printAsMuchAsPossible(axiosError)
        throw new BridgeXYZError(`Error in _GET: ${safeStringify(axiosError.response.data)}`, axiosError.response.status, axiosError.response.data, axiosError)
    }
}

export const getOrCreateUserBridge = async (email: string, userId: string) => {
    // XXX: dave@tungstenfi.com is the "root" user or business, so I can't create an individual account!
    if (_SPECIAL_CASE_EMAILS.includes(email)) {
        const [username, domain] = email.split('@')
        email = `${username}+collision@${domain}`
    }

    // does the user have an existing Bridge record?
    const userBridge = await prisma.userBridge.findUnique({ where: { email: email } })
    if (userBridge) {
        return userBridge
    }
    console.log(`Creating new userBridge for ${email}`)

    // via Charlie @ Bridge: , yes this can be done now. You could pass in a UUID for the full name to identify the user and when the customer is created we create them using the name from the KYC. We still do need their email though.
    // https://apidocs.bridge.xyz/reference/post_kyc-links
    let kycLink
    try {
        kycLink = await _POST('kyc_links', {
            full_name: userId,
            email: email,
            type: 'individual', // or "business"
        })
    } catch (error) {
        Sentry.captureException(error)
        throw error
    }

    // this is simply KYC & TOS info, which are per-user
    return await prisma.userBridge.create({
        data: {
            id: kycLink.id,
            email: email,
            ownerId: userId,
            fullName: kycLink.full_name,
            type: kycLink.type,
            kycLink: kycLink.kyc_link,
            tosLink: kycLink.tos_link,
            kycStatus: kycLink.kyc_status,
            tosStatus: kycLink.tos_status,
            createdAt: new Date(kycLink.created_at),
            customerId: kycLink.customer_id,
        },
    })
}

export const getExternalAccounts = async (customerId: string) => {
    const empty = { count: 0, data: [], error: 'No customer ID assigned yet' }
    if (!customerId) return empty

    // if we have a customer ID, they may have external accounts already connected. return them
    try {
        return _GET(`customers/${customerId}/external_accounts`)
    } catch (error) {
        Sentry.captureException(error)
        console.error(`Error in getExternalAccounts: ${error.message}`)
        return empty
    }
}

export const createExternalAccount = async (customerId: string, externalAccount: any) => {
    try {
        console.log(`createExternalAccount: ${safeStringify(externalAccount)}`)
        const rc = await _POST(`customers/${customerId}/external_accounts`, externalAccount)
        console.log('external_account create', rc)
        return rc
    } catch (error) {
        Sentry.captureException(error)
        console.error(`Error in createExternalAccount: ${error.toString()}`)
        return null
    }
}

export const getLiquidationAddresses = async (customerId: string) => {
    const empty = { count: 0, data: [], error: 'No customer ID assigned yet' }
    if (!customerId) return empty

    // if we have a customer ID, they may have external accounts already connected. return them
    try {
        return _GET(`customers/${customerId}/liquidation_addresses`)
    } catch (error) {
        Sentry.captureException(error)
        console.error(`Error in getLiquidationAddresses: ${error.message}`)
        return empty
    }
}

export const createLiquidationAddress = async (customerId: string, details: any) => {
    try {
        console.log(`createLiquidationAddress: ${safeStringify(details)}`)
        const rc = _POST(`customers/${customerId}/liquidation_addresses`, {
            ...details,
            ...{
                chain: 'optimism',
                currency: 'usdc',
                destination_payment_rail: 'ach',
            },
        })
        console.log('liquidation_address create', rc)

        return rc
    } catch (error) {
        Sentry.captureException(error)
        console.error(`Error in createLiquidationAddress: ${error.toString()}`)
        return null
    }
}
