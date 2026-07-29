import xhr from './xhr.js'
import fetch from './fetch.js'
import eventSource from './event-source.js'
import {createRequestPatch} from './request-patch.js'

const request = {
    xhr,
    fetch,
    eventSource,
    createRequestPatch
}

export default request
