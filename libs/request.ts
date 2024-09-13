import { getAccessToken } from '@privy-io/react-auth' // import the getToken function

const loadJwt = async (overrideToken?: string): Promise<string> => {
    if (typeof overrideToken === 'string') return overrideToken

    return await getAccessToken()
}

export const POST = async (url: string, body?: Object, authToken?: string, cache = true) => {
    const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (await loadJwt(authToken)),
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    const _data = await res.json()
    return { data: _data, status: res.status, error: _data?.error }
}

type GetResult<T> = {
    data?: T
    error?: string
    status: number
}

export const GET = async <T>(url: string, authToken?: string, cache = true): Promise<GetResult<T>> => {
    const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (await loadJwt(authToken)),
        },
    })
    const _data = await res.json()
    return { data: _data, status: res.status, error: _data?.error }
}

export const PUT = async (url: string, body?: Object, authToken?: string, cache = true) => {
    const res = await fetch(url, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + (await loadJwt(authToken)),
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    const _data = await res.json()
    return { data: _data, status: res.status, error: _data?.error }
}
