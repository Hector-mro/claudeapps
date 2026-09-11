import { describe, expect, it } from 'vitest'
import type { ArchivedCompletion, SyncSnapshot, Todo } from '../types'
import { applyPending, diffState, EMPTY_SNAPSHOT, hasChanges } from './diff'

function todo(id: string, overrides: Partial<Todo> = {}): Todo {
  return { id, text: id, createdAt: 0, difficulty: 'easy', done: false, zone: 'commun', ...overrides }
}

function archived(id: string): ArchivedCompletion {
  return { id, completedAt: 0, difficulty: 'easy', zone: 'commun' }
}

function snapshot(todos: Todo[], archivedCompletions: ArchivedCompletion[] = []): SyncSnapshot {
  return { todos, archived: archivedCompletions }
}

describe('diffState', () => {
  it('finds new, edited and deleted todos and new archived completions', () => {
    const base = snapshot([todo('kept'), todo('edited'), todo('deleted')], [archived('old')])
    const current = snapshot(
      [todo('kept'), todo('edited', { done: true }), todo('new')],
      [archived('old'), archived('fresh')],
    )

    expect(diffState(base, current)).toEqual({
      upserts: [todo('edited', { done: true }), todo('new')],
      deletes: ['deleted'],
      archived: [archived('fresh')],
    })
  })

  it('ignores key order and undefined fields', () => {
    const rebuilt: Todo = {
      zone: 'commun',
      done: false,
      difficulty: 'easy',
      createdAt: 0,
      text: 'a',
      id: 'a',
      dueAt: undefined,
    }

    expect(hasChanges(diffState(snapshot([todo('a')]), snapshot([rebuilt])))).toBe(false)
  })

  it('treats everything as pending on a device that never synced', () => {
    expect(diffState(EMPTY_SNAPSHOT, snapshot([todo('a')], [archived('x')]))).toEqual({
      upserts: [todo('a')],
      deletes: [],
      archived: [archived('x')],
    })
  })
})

describe('applyPending', () => {
  it('merges a first connection with the server by id', () => {
    const server = snapshot([todo('nina')])
    const local = snapshot([todo('hector')])

    expect(applyPending(server, diffState(EMPTY_SNAPSHOT, local)).todos.map((t) => t.id)).toEqual(['nina', 'hector'])
  })

  it('keeps pending edits and deletions over the server state', () => {
    const base = snapshot([todo('a'), todo('b')])
    const current = snapshot([todo('a', { text: 'local edit' })])
    const server = snapshot([todo('a', { text: 'remote edit' }), todo('b'), todo('c')])

    expect(applyPending(server, diffState(base, current)).todos).toEqual([todo('a', { text: 'local edit' }), todo('c')])
  })

  it('drops tasks deleted on the server when they had no pending edit', () => {
    const base = snapshot([todo('a'), todo('b')])

    expect(applyPending(snapshot([todo('a')]), diffState(base, base)).todos).toEqual([todo('a')])
  })

  it('lets an edit the server refused disappear once it has answered', () => {
    // The device edited a task the other device had deleted; the server kept the deletion.
    const sent = snapshot([todo('a', { done: true })])

    expect(applyPending(snapshot([]), diffState(sent, sent)).todos).toEqual([])
  })

  it('re-applies only the changes made while the request was out', () => {
    const sent = snapshot([todo('a')])
    const now = snapshot([todo('a'), todo('b')])
    const server = snapshot([todo('a'), todo('remote')])

    expect(applyPending(server, diffState(sent, now)).todos.map((t) => t.id)).toEqual(['a', 'remote', 'b'])
  })

  it('appends archived completions the server does not have yet', () => {
    const server = snapshot([], [archived('x')])
    const pending = diffState(EMPTY_SNAPSHOT, snapshot([], [archived('x'), archived('y')]))

    expect(applyPending(server, pending).archived).toEqual([archived('x'), archived('y')])
  })
})
