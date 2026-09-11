import { describe, expect, it } from 'vitest'
import { countBadge, localDateKey, zonesFor } from './notify'
import type { Todo } from './types'

const PARIS = 'Europe/Paris'

function todo(overrides: Partial<Todo>): Todo {
  return { id: crypto.randomUUID(), text: 't', createdAt: 0, difficulty: 'easy', done: false, zone: 'hector', ...overrides }
}

describe('localDateKey', () => {
  it('reads the calendar day in the given time zone', () => {
    // 23:30 UTC on 11 September is already 01:30 on the 12th in Paris (UTC+2 in summer).
    const lateEvening = Date.UTC(2026, 8, 11, 23, 30)
    expect(localDateKey(lateEvening, 'UTC')).toBe('2026-09-11')
    expect(localDateKey(lateEvening, PARIS)).toBe('2026-09-12')
  })
})

describe('zonesFor', () => {
  it('gives each person their own zone plus the shared one', () => {
    expect(zonesFor('hector')).toEqual(['hector', 'commun'])
    expect(zonesFor('nina')).toEqual(['nina', 'commun'])
  })
})

describe('countBadge', () => {
  it('counts open tasks due today or earlier, in the given zones only', () => {
    const noon = Date.UTC(2026, 8, 11, 10, 0) // 12:00 in Paris
    const todos = [
      todo({ dueAt: Date.UTC(2026, 8, 11, 16, 0) }), // this evening: counts
      todo({ dueAt: Date.UTC(2026, 8, 9, 8, 0) }), // overdue: counts
      todo({ dueAt: Date.UTC(2026, 8, 11, 21, 30), zone: 'commun' }), // 23:30 in Paris, still today: counts
      todo({ dueAt: Date.UTC(2026, 8, 11, 22, 30) }), // 00:30 tomorrow in Paris: no
      todo({ dueAt: Date.UTC(2026, 8, 11, 8, 0), done: true }), // done: no
      todo({ dueAt: Date.UTC(2026, 8, 11, 8, 0), zone: 'nina' }), // someone else's zone: no
      todo({}), // no due date: no
    ]

    expect(countBadge(todos, zonesFor('hector'), noon, PARIS)).toBe(3)
  })
})
