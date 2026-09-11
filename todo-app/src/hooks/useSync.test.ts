import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArchivedCompletion, SyncChanges, Todo } from '../types'
import { useSync } from './useSync'
import { useTodos } from './useTodos'

const KEY = 'secret'

function remoteTodo(id: string): Todo {
  return { id, text: id, createdAt: 0, difficulty: 'easy', done: false, zone: 'commun' }
}

/** In-memory stand-in for `worker/index.ts`, with the same rules (404 on a wrong code, tombstones). */
function fakeServer(initial: Todo[] = []) {
  const todos = new Map(initial.map((t) => [t.id, t]))
  const deleted = new Set<string>()
  const archived = new Map<string, ArchivedCompletion>()
  let reachable = true

  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!reachable) throw new TypeError('Failed to fetch')
    if (new Headers(init?.headers).get('authorization') !== `Bearer ${KEY}`) {
      return Response.json({ error: 'not_found' }, { status: 404 })
    }
    if (url.endsWith('/api/sync')) {
      const changes = JSON.parse(String(init?.body)) as SyncChanges
      for (const t of changes.upserts) if (!deleted.has(t.id)) todos.set(t.id, t)
      for (const id of changes.deletes) {
        todos.delete(id)
        deleted.add(id)
      }
      for (const a of changes.archived) if (!archived.has(a.id)) archived.set(a.id, a)
    }
    return Response.json({ todos: [...todos.values()], archived: [...archived.values()] })
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    todos,
    fetchMock,
    deleteElsewhere(id: string) {
      todos.delete(id)
      deleted.add(id)
    },
    setReachable(value: boolean) {
      reachable = value
    },
  }
}

function useSyncedTodos() {
  const store = useTodos()
  const sync = useSync({
    todos: store.todos,
    archivedCompletions: store.archivedCompletions,
    replaceAll: store.replaceAll,
  })
  return { ...store, sync }
}

function connectWith(key: string) {
  localStorage.setItem('todo-app:key:v1', JSON.stringify(key))
}

/** Longer than the push delay. */
const PUSH_TIMEOUT = { timeout: 3000 }

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useSync', () => {
  it('stays local and never calls the server without an access code', () => {
    const server = fakeServer()
    const { result } = renderHook(() => useSyncedTodos())

    expect(result.current.sync.status).toBe('local')
    expect(server.fetchMock).not.toHaveBeenCalled()
  })

  it('merges local tasks with the server on first connection', async () => {
    const server = fakeServer([remoteTodo('from-nina')])
    localStorage.setItem('todo-app:v1', JSON.stringify([remoteTodo('from-hector')]))
    connectWith(KEY)

    const { result } = renderHook(() => useSyncedTodos())

    await waitFor(() => expect(result.current.sync.status).toBe('synced'))
    expect(result.current.todos.map((t) => t.id).sort()).toEqual(['from-hector', 'from-nina'])
    expect([...server.todos.keys()].sort()).toEqual(['from-hector', 'from-nina'])
  })

  it('pushes a new task shortly after it is added', async () => {
    const server = fakeServer()
    connectWith(KEY)
    const { result } = renderHook(() => useSyncedTodos())
    await waitFor(() => expect(result.current.sync.status).toBe('synced'))

    act(() => result.current.addTodo({ text: 'Courses', difficulty: 'easy', zone: 'commun' }))
    expect(result.current.sync.status).toBe('pending')

    await waitFor(() => expect(result.current.sync.status).toBe('synced'), PUSH_TIMEOUT)
    expect([...server.todos.values()].map((t) => t.text)).toEqual(['Courses'])
  })

  it('keeps changes made offline and sends them when the network returns', async () => {
    const server = fakeServer()
    server.setReachable(false)
    connectWith(KEY)
    const { result } = renderHook(() => useSyncedTodos())
    await waitFor(() => expect(result.current.sync.status).toBe('offline'))

    act(() => result.current.addTodo({ text: 'Hors ligne', difficulty: 'easy', zone: 'commun' }))
    server.setReachable(true)
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(result.current.sync.status).toBe('synced'), PUSH_TIMEOUT)
    expect([...server.todos.values()].map((t) => t.text)).toEqual(['Hors ligne'])
  })

  it('drops a task the other device deleted', async () => {
    const server = fakeServer([remoteTodo('a'), remoteTodo('b')])
    connectWith(KEY)
    const { result } = renderHook(() => useSyncedTodos())
    await waitFor(() => expect(result.current.todos).toHaveLength(2))

    server.deleteElsewhere('b')
    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    await waitFor(() => expect(result.current.todos.map((t) => t.id)).toEqual(['a']))
  })

  it('does not bring back a task deleted elsewhere when a stale edit is pushed', async () => {
    const server = fakeServer([remoteTodo('a')])
    connectWith(KEY)
    const { result } = renderHook(() => useSyncedTodos())
    await waitFor(() => expect(result.current.todos).toHaveLength(1))

    server.deleteElsewhere('a')
    act(() => result.current.toggleTodo('a'))

    await waitFor(() => expect(result.current.todos).toEqual([]), PUSH_TIMEOUT)
    expect(server.todos.size).toBe(0)
  })

  it('reports a refused access code', async () => {
    fakeServer()
    connectWith('wrong')
    const { result } = renderHook(() => useSyncedTodos())

    await waitFor(() => expect(result.current.sync.status).toBe('bad-key'))
  })
})
