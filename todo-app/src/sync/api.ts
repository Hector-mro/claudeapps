import type { PushSubscribeBody, SyncChanges, SyncSnapshot } from '../types'
import { parseSnapshot } from '../validation'

/** `bad-key`: the server refused the access code. `offline`: no usable answer — try again later. */
export type SyncFailure = 'bad-key' | 'offline'

export class SyncError extends Error {
  readonly failure: SyncFailure

  constructor(failure: SyncFailure) {
    super(failure)
    this.failure = failure
  }
}

/** One authenticated call: `GET` without a body, `POST` with one. */
async function send(apiUrl: string, key: string, path: string, body?: object): Promise<Response> {
  const authorization = `Bearer ${key}`
  let response: Response
  try {
    response = await fetch(apiUrl + path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { authorization, 'content-type': 'application/json' } : { authorization },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new SyncError('offline')
  }

  // The worker answers a wrong code with 404, never 403.
  if (response.status === 404) throw new SyncError('bad-key')
  return response
}

async function request(apiUrl: string, key: string, path: string, changes?: SyncChanges): Promise<SyncSnapshot> {
  const response = await send(apiUrl, key, path, changes)
  const snapshot = response.ok ? parseSnapshot(await response.json().catch(() => null)) : null
  if (!snapshot) throw new SyncError('offline')
  return snapshot
}

async function post(apiUrl: string, key: string, path: string, body: object): Promise<void> {
  const response = await send(apiUrl, key, path, body)
  if (!response.ok) throw new SyncError('offline')
}

/** The server's full state. */
export function fetchState(apiUrl: string, key: string): Promise<SyncSnapshot> {
  return request(apiUrl, key, '/api/state')
}

/** Sends `changes`; resolves to the server's full state once they're applied. */
export function pushChanges(apiUrl: string, key: string, changes: SyncChanges): Promise<SyncSnapshot> {
  return request(apiUrl, key, '/api/sync', changes)
}

/** Registers (or refreshes) this phone's push subscription. */
export function subscribePush(apiUrl: string, key: string, body: PushSubscribeBody): Promise<void> {
  return post(apiUrl, key, '/api/push/subscribe', body)
}

/** Tells the server to stop notifying this subscription. */
export function unsubscribePush(apiUrl: string, key: string, endpoint: string): Promise<void> {
  return post(apiUrl, key, '/api/push/unsubscribe', { endpoint })
}
