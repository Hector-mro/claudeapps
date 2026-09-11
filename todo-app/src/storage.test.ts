import { describe, expect, it } from 'vitest'
import {
  LEGACY_ZONE,
  loadAccessKey,
  loadArchivedCompletions,
  loadSyncBase,
  loadTodos,
  saveAccessKey,
  saveSyncBase,
} from './storage'

describe('storage zone migration', () => {
  it('files todos saved before zones existed under the legacy zone', () => {
    localStorage.setItem(
      'todo-app:v1',
      JSON.stringify([
        { id: '1', text: 'Ancienne', createdAt: 0, difficulty: 'easy', done: false },
        { id: '2', text: 'Nina', createdAt: 0, difficulty: 'easy', done: false, zone: 'nina' },
        { id: '3', text: 'Inconnue', createdAt: 0, difficulty: 'easy', done: false, zone: 'ailleurs' },
      ]),
    )

    expect(loadTodos().map((t) => t.zone)).toEqual([LEGACY_ZONE, 'nina', LEGACY_ZONE])
  })

  it('files archived completions saved before zones existed under the legacy zone', () => {
    localStorage.setItem(
      'todo-app:archived:v1',
      JSON.stringify([
        { completedAt: 1, difficulty: 'hard' },
        { completedAt: 2, difficulty: 'easy', zone: 'commun' },
      ]),
    )

    expect(loadArchivedCompletions()).toEqual([
      { id: expect.any(String), completedAt: 1, difficulty: 'hard', zone: LEGACY_ZONE },
      { id: expect.any(String), completedAt: 2, difficulty: 'easy', zone: 'commun' },
    ])
  })
})

describe('storage archived completion ids', () => {
  it('keeps existing ids and gives entries saved before sync a unique one', () => {
    localStorage.setItem(
      'todo-app:archived:v1',
      JSON.stringify([
        { id: 'kept', completedAt: 1, difficulty: 'hard', zone: 'hector' },
        { completedAt: 2, difficulty: 'easy', zone: 'hector' },
        { completedAt: 3, difficulty: 'easy', zone: 'hector' },
      ]),
    )

    const [kept, first, second] = loadArchivedCompletions()

    expect(kept.id).toBe('kept')
    expect(first.id).toEqual(expect.any(String))
    expect(first.id).not.toBe(second.id)
  })
})

describe('sync storage', () => {
  it('has no sync base or access code on a device that never connected', () => {
    expect(loadSyncBase()).toBeNull()
    expect(loadAccessKey()).toBeNull()
  })

  it('round-trips the sync base and the access code', () => {
    const base = {
      todos: [{ id: '1', text: 'A', createdAt: 0, difficulty: 'easy' as const, done: false, zone: 'commun' as const }],
      archived: [{ id: 'x', completedAt: 1, difficulty: 'hard' as const, zone: 'nina' as const }],
    }
    saveSyncBase(base)
    saveAccessKey('code')

    expect(loadSyncBase()).toEqual(base)
    expect(loadAccessKey()).toBe('code')
  })
})
