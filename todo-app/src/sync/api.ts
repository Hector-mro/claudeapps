import type { SyncChanges, SyncSnapshot } from '../types'
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

async function request(apiUrl: string, key: string, path: string, changes?: SyncChanges): Promise<SyncSnapshot> {
  let response: Response
  try {
    response = await fetch(apiUrl + path, {
      method: changes ? 'POST' : 'GET',
      headers: changes
        ? { authorization: `Bearer ${key}`, 'content-type': 'application/json' }
        : { authorization: `Bearer ${key}` },
      body: changes ? JSON.stringify(changes) : undefined,
    })
  } catch {
    throw new SyncError('offline')
  }

  // The worker answers a wrong code with 404, never 403.
  if (response.status === 404) throw new SyncError('bad-key')
  const snapshot = response.ok ? parseSnapshot(await response.json().catch(() => null)) : null
  if (!snapshot) throw new SyncError('offline')
  return snapshot
}

/** The server's full state. */
export function fetchState(apiUrl: string, key: string): Promise<SyncSnapshot> {
  return request(apiUrl, key, '/api/state')
}

/** Sends `changes`; resolves to the server's full state once they're applied. */
export function pushChanges(apiUrl: string, key: string, changes: SyncChanges): Promise<SyncSnapshot> {
  return request(apiUrl, key, '/api/sync', changes)
}
