import type { ArchivedCompletion, Person, SyncSnapshot, Todo, Zone } from './types'
import {
  isPerson,
  isStoredArchivedCompletion,
  isStoredTodo,
  isZone,
  parseSnapshot,
  type Stored,
  type StoredArchivedCompletion,
} from './validation'

const STORAGE_KEY = 'todo-app:v1'
const ARCHIVED_STORAGE_KEY = 'todo-app:archived:v1'
const SYNC_BASE_STORAGE_KEY = 'todo-app:base:v1'
const ACCESS_KEY_STORAGE_KEY = 'todo-app:key:v1'
const PERSON_STORAGE_KEY = 'todo-app:person:v1'

/** Zone given to entries saved before zones existed (they carry no `zone` field). */
export const LEGACY_ZONE: Zone = 'hector'

function toTodo(t: Stored<Todo>): Todo {
  return { ...t, zone: isZone(t.zone) ? t.zone : LEGACY_ZONE }
}

/** Entries saved before sync existed have no `id`: they get one here, persisted by the next save. */
function toArchivedCompletion(a: StoredArchivedCompletion): ArchivedCompletion {
  return {
    ...a,
    id: typeof a.id === 'string' ? a.id : crypto.randomUUID(),
    zone: isZone(a.zone) ? a.zone : LEGACY_ZONE,
  }
}

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage disabled or full — app continues to work in-memory for this session.
  }
}

export function loadTodos(): Todo[] {
  const parsed = readJson(STORAGE_KEY)
  return Array.isArray(parsed) ? parsed.filter(isStoredTodo).map(toTodo) : []
}

export function saveTodos(todos: Todo[]): void {
  writeJson(STORAGE_KEY, todos)
}

export function loadArchivedCompletions(): ArchivedCompletion[] {
  const parsed = readJson(ARCHIVED_STORAGE_KEY)
  return Array.isArray(parsed) ? parsed.filter(isStoredArchivedCompletion).map(toArchivedCompletion) : []
}

export function saveArchivedCompletions(archived: ArchivedCompletion[]): void {
  writeJson(ARCHIVED_STORAGE_KEY, archived)
}

/** The last state the server confirmed (see `sync/diff.ts`), or `null` if this device never synced. */
export function loadSyncBase(): SyncSnapshot | null {
  return parseSnapshot(readJson(SYNC_BASE_STORAGE_KEY))
}

export function saveSyncBase(base: SyncSnapshot): void {
  writeJson(SYNC_BASE_STORAGE_KEY, base)
}

/** The shared access code for the sync API, or `null` while this device is local-only. */
export function loadAccessKey(): string | null {
  const key = readJson(ACCESS_KEY_STORAGE_KEY)
  return typeof key === 'string' && key !== '' ? key : null
}

export function saveAccessKey(key: string): void {
  writeJson(ACCESS_KEY_STORAGE_KEY, key)
}

/** Whose phone this is, chosen when turning notifications on; `null` until then. */
export function loadPerson(): Person | null {
  const person = readJson(PERSON_STORAGE_KEY)
  return isPerson(person) ? person : null
}

export function savePerson(person: Person): void {
  writeJson(PERSON_STORAGE_KEY, person)
}
