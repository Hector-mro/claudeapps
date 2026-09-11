import type { SyncChanges, SyncSnapshot, Todo } from '../types'

// The sync model. Each device keeps a *base*: the last state the server
// confirmed. Whatever differs between the base and the device's current state
// is what the device still has to send — so offline edits need no separate
// outbox, they survive a reload as long as both snapshots are stored.
// Each todo is last-write-wins; archived completions are append-only.

export const EMPTY_SNAPSHOT: SyncSnapshot = { todos: [], archived: [] }

/** Key-order independent, so a todo rebuilt by a spread still equals the server's copy. */
function canonical(todo: Todo): string {
  return JSON.stringify(todo, Object.keys(todo).sort())
}

/** What `current` changed relative to `base`. */
export function diffState(base: SyncSnapshot, current: SyncSnapshot): SyncChanges {
  const baseTodos = new Map(base.todos.map((t) => [t.id, t]))
  const currentIds = new Set(current.todos.map((t) => t.id))
  const baseArchivedIds = new Set(base.archived.map((a) => a.id))

  return {
    upserts: current.todos.filter((t) => {
      const before = baseTodos.get(t.id)
      return before === undefined || canonical(before) !== canonical(t)
    }),
    deletes: base.todos.filter((t) => !currentIds.has(t.id)).map((t) => t.id),
    archived: current.archived.filter((a) => !baseArchivedIds.has(a.id)),
  }
}

export function hasChanges(changes: SyncChanges): boolean {
  return changes.upserts.length > 0 || changes.deletes.length > 0 || changes.archived.length > 0
}

/** `server` with `pending` laid back on top: pending edits win, pending deletions stay deleted. */
export function applyPending(server: SyncSnapshot, pending: SyncChanges): SyncSnapshot {
  const upserts = new Map(pending.upserts.map((t) => [t.id, t]))
  const deletes = new Set(pending.deletes)
  const serverIds = new Set(server.todos.map((t) => t.id))
  const serverArchivedIds = new Set(server.archived.map((a) => a.id))

  return {
    todos: [
      ...server.todos.filter((t) => !deletes.has(t.id)).map((t) => upserts.get(t.id) ?? t),
      ...pending.upserts.filter((t) => !serverIds.has(t.id)),
    ],
    archived: [...server.archived, ...pending.archived.filter((a) => !serverArchivedIds.has(a.id))],
  }
}
