import {
  PERSONS,
  ZONES,
  type ArchivedCompletion,
  type Difficulty,
  type Person,
  type PushSubscribeBody,
  type SyncChanges,
  type SyncSnapshot,
  type Todo,
  type Zone,
} from './types'

// Type guards shared by the app (localStorage, server responses) and the sync
// worker (request bodies, see `worker/index.ts`) — so this file must stay DOM-free.

/** A value read back from local storage, before its `zone` has been checked. */
export type Stored<T extends { zone: Zone }> = Omit<T, 'zone'> & { zone?: unknown }

/** An archived completion read back from local storage: saved before zones or ids existed, it may lack either. */
export type StoredArchivedCompletion = Omit<ArchivedCompletion, 'zone' | 'id'> & { zone?: unknown; id?: unknown }

export function isZone(value: unknown): value is Zone {
  return ZONES.includes(value as Zone)
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === 'easy' || value === 'medium' || value === 'hard'
}

function isOptional(value: unknown, type: 'number' | 'string'): boolean {
  return value === undefined || typeof value === type
}

/** Loose check for a todo from local storage: its `zone` may be missing or unknown. */
export function isStoredTodo(value: unknown): value is Stored<Todo> {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.text === 'string' &&
    typeof t.createdAt === 'number' &&
    typeof t.done === 'boolean' &&
    isDifficulty(t.difficulty)
  )
}

/** Loose check for an archived completion from local storage: its `zone` and `id` may be missing. */
export function isStoredArchivedCompletion(value: unknown): value is StoredArchivedCompletion {
  if (typeof value !== 'object' || value === null) return false
  const a = value as Record<string, unknown>
  return typeof a.completedAt === 'number' && isDifficulty(a.difficulty)
}

/** Strict check for a todo exchanged with the server. */
export function isTodo(value: unknown): value is Todo {
  if (!isStoredTodo(value)) return false
  const { zone, dueAt, completedAt, parentId } = value
  return isZone(zone) && isOptional(dueAt, 'number') && isOptional(completedAt, 'number') && isOptional(parentId, 'string')
}

/** Strict check for an archived completion exchanged with the server. */
export function isArchivedCompletion(value: unknown): value is ArchivedCompletion {
  return isStoredArchivedCompletion(value) && typeof value.id === 'string' && isZone(value.zone)
}

/** A full synced state (server response, or the stored sync base); invalid entries are dropped. */
export function parseSnapshot(value: unknown): SyncSnapshot | null {
  if (typeof value !== 'object' || value === null) return null
  const { todos, archived } = value as Record<string, unknown>
  if (!Array.isArray(todos) || !Array.isArray(archived)) return null
  return { todos: todos.filter(isTodo), archived: archived.filter(isArchivedCompletion) }
}

export function isPerson(value: unknown): value is Person {
  return PERSONS.includes(value as Person)
}

function isTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/** The body of `POST /api/push/subscribe`, or `null` if anything in it is off. */
export function parsePushSubscribeBody(value: unknown): PushSubscribeBody | null {
  if (typeof value !== 'object' || value === null) return null
  const { endpoint, keys, person, timeZone, welcome } = value as Record<string, unknown>
  if (typeof endpoint !== 'string' || !endpoint.startsWith('https://')) return null
  if (typeof keys !== 'object' || keys === null) return null
  const { p256dh, auth } = keys as Record<string, unknown>
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth) return null
  if (!isPerson(person) || !isTimeZone(timeZone)) return null
  return { endpoint, keys: { p256dh, auth }, person, timeZone, welcome: welcome === true }
}

/** The body of `POST /api/sync`; rejected as a whole if any entry is invalid. */
export function parseChanges(value: unknown): SyncChanges | null {
  if (typeof value !== 'object' || value === null) return null
  const { upserts, deletes, archived } = value as Record<string, unknown>
  if (!Array.isArray(upserts) || !Array.isArray(deletes) || !Array.isArray(archived)) return null
  const valid =
    upserts.every(isTodo) && deletes.every((id) => typeof id === 'string') && archived.every(isArchivedCompletion)
  return valid ? { upserts, deletes, archived } : null
}
