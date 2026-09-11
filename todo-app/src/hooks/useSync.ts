import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { loadAccessKey, loadSyncBase, saveAccessKey, saveSyncBase } from '../storage'
import { fetchState, pushChanges, SyncError } from '../sync/api'
import { API_URL } from '../sync/config'
import { applyPending, diffState, EMPTY_SNAPSHOT, hasChanges } from '../sync/diff'
import type { ArchivedCompletion, SyncSnapshot, Todo } from '../types'

/**
 * `local`: no access code, this device only. `pending`: changes (or the first
 * check) not yet confirmed. `offline`: last attempt failed, changes are kept.
 */
export type SyncState = 'local' | 'pending' | 'synced' | 'offline' | 'bad-key'

/** Delay after the last local change before pushing, so a burst of edits goes out as one request. */
const PUSH_DELAY_MS = 800

type Connection = 'checking' | 'ok' | 'offline' | 'bad-key'

interface UseSyncArgs {
  todos: Todo[]
  archivedCompletions: ArchivedCompletion[]
  /** Must be stable across renders (see `useTodos#replaceAll`). */
  replaceAll: (snapshot: SyncSnapshot) => void
}

/**
 * Keeps `useTodos`' state in step with the sync API (model in `sync/diff.ts`).
 * Pulls on open, when the app comes back to the foreground and when the network
 * returns; pushes shortly after each local change. Does nothing without an access code.
 */
export function useSync({ todos, archivedCompletions, replaceAll }: UseSyncArgs) {
  const [key, setKey] = useState(() => loadAccessKey())
  const [connection, setConnection] = useState<Connection>('checking')
  const [base, setBase] = useState(() => loadSyncBase() ?? EMPTY_SNAPSHOT)
  const current = useMemo(() => ({ todos, archived: archivedCompletions }), [todos, archivedCompletions])
  const hasPending = useMemo(() => hasChanges(diffState(base, current)), [base, current])

  // The sync loop reads these after `await`s: it needs the latest values, not a past render's.
  const baseRef = useRef(base)
  const currentRef = useRef(current)
  const inFlight = useRef(false)
  const queued = useRef(false)

  useLayoutEffect(() => {
    currentRef.current = current
  }, [current])

  const sync = useCallback(async () => {
    if (!key) return
    if (inFlight.current) {
      queued.current = true
      return
    }
    inFlight.current = true
    try {
      do {
        queued.current = false
        const sent = currentRef.current
        const pending = diffState(baseRef.current, sent)
        const server = hasChanges(pending) ? await pushChanges(API_URL, key, pending) : await fetchState(API_URL, key)

        // Only what changed while the request was out still needs sending; everything
        // else is now what the server says — including the other device's edits, and
        // minus any edit the server refused because that task was deleted meanwhile.
        const now = currentRef.current
        const next = applyPending(server, diffState(sent, now))
        baseRef.current = server
        setBase(server)
        saveSyncBase(server)
        if (hasChanges(diffState(now, next))) {
          currentRef.current = next
          replaceAll(next)
        }
        setConnection('ok')
      } while (queued.current)
    } catch (error) {
      setConnection(error instanceof SyncError && error.failure === 'bad-key' ? 'bad-key' : 'offline')
    } finally {
      inFlight.current = false
    }
  }, [key, replaceAll])

  useEffect(() => {
    if (!key) return
    void sync()
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void sync()
    }
    function onOnline() {
      void sync()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('online', onOnline)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('online', onOnline)
    }
  }, [key, sync])

  // `current` is a dependency so that every new edit restarts the delay.
  useEffect(() => {
    if (!key || !hasPending || connection === 'bad-key') return
    const timer = setTimeout(() => void sync(), PUSH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [key, hasPending, connection, current, sync])

  const connect = useCallback(
    (code: string) => {
      const trimmed = code.trim()
      if (!trimmed) return
      saveAccessKey(trimmed)
      setConnection('checking')
      // Same code again (e.g. retrying after "code refusé"): the key effect won't re-run, so sync directly.
      if (trimmed === key) void sync()
      else setKey(trimmed)
    },
    [key, sync],
  )

  let status: SyncState
  if (!key) status = 'local'
  else if (connection === 'bad-key' || connection === 'offline') status = connection
  else status = hasPending || connection === 'checking' ? 'pending' : 'synced'

  return { status, connect }
}
