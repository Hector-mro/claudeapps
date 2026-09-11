import { describe, expect, it } from 'vitest'
import { LEGACY_ZONE, loadArchivedCompletions, loadTodos } from './storage'

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
      { completedAt: 1, difficulty: 'hard', zone: LEGACY_ZONE },
      { completedAt: 2, difficulty: 'easy', zone: 'commun' },
    ])
  })
})
