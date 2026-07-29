const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key)

function normalizeHeaders(headers = {}) {
    const normalized = {}
    const entries = typeof headers.entries === 'function'
        ? headers.entries()
        : Object.entries(headers)

    for (const [name, value] of entries) {
        normalized[String(name).toLowerCase()] = String(value)
    }
    return normalized
}

function mergeHeaders(headers, patch = {}) {
    const merged = normalizeHeaders(headers)
    for (const [name, value] of Object.entries(patch || {})) {
        const key = name.toLowerCase()
        if (value === null) delete merged[key]
        else if (value !== undefined) merged[key] = String(value)
    }
    return merged
}

function mergeQuery(url, query) {
    if (!query) return url

    const hashIndex = url.indexOf('#')
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : ''
    const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url
    const queryIndex = withoutHash.indexOf('?')
    const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash
    const search = new URLSearchParams(queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '')

    for (const [name, value] of Object.entries(query)) {
        if (value === null) search.delete(name)
        else if (value !== undefined) search.set(name, String(value))
    }

    const serialized = search.toString()
    return `${path}${serialized ? `?${serialized}` : ''}${hash}`
}

export function createRequestPatch(snapshot, patch = {}) {
    if (!patch || typeof patch !== 'object') return {...snapshot, headers: {...snapshot.headers}}

    const url = mergeQuery(
        hasOwn(patch, 'url') && patch.url !== undefined ? String(patch.url) : snapshot.url,
        patch.query
    )
    const next = {
        ...snapshot,
        url,
        headers: mergeHeaders(snapshot.headers, patch.headers)
    }
    if (hasOwn(patch, 'body')) next.body = patch.body
    return next
}

export async function applyBeforeRequest(snapshot, beforeRequest) {
    const isolated = Object.freeze({
        ...snapshot,
        headers: Object.freeze({...normalizeHeaders(snapshot.headers)})
    })
    if (typeof beforeRequest !== 'function') {
        return {...isolated, headers: {...isolated.headers}}
    }
    const patch = await beforeRequest(isolated)
    return createRequestPatch(isolated, patch)
}

export {normalizeHeaders}
