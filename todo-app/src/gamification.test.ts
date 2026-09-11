import { describe, expect, it } from 'vitest'
import { addDays } from './dateUtils'
import { computeStreak, deriveGamification, levelForXp, xpByDay } from './gamification'
import type { ArchivedCompletion, Todo } from './types'

const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime()

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: Math.random().toString(36),
    text: 'test',
    createdAt: NOW,
    difficulty: 'medium',
    done: false,
    ...overrides,
  }
}

describe('levelForXp', () => {
  it('stays on level 1 just below the level-2 threshold', () => {
    expect(levelForXp(99)).toEqual({ level: 1, xpIntoLevel: 99, xpForNextLevel: 100, progress: 0.99 })
  })

  it('reaches level 2 exactly at the threshold', () => {
    expect(levelForXp(100)).toEqual({ level: 2, xpIntoLevel: 0, xpForNextLevel: 200, progress: 0 })
  })

  it('accrues progress within a level', () => {
    expect(levelForXp(101)).toEqual({ level: 2, xpIntoLevel: 1, xpForNextLevel: 200, progress: 0.005 })
  })
})

describe('deriveGamification', () => {
  it('sums XP only for done todos, weighted by difficulty', () => {
    const todos = [
      makeTodo({ difficulty: 'easy', done: true, completedAt: NOW }),
      makeTodo({ difficulty: 'easy', done: true, completedAt: NOW }),
      makeTodo({ difficulty: 'medium', done: true, completedAt: NOW }),
      makeTodo({ difficulty: 'hard', done: false }),
    ]

    const result = deriveGamification(todos, NOW)
    expect(result.xp).toBe(40)
    expect(result.level).toBe(1)
    expect(result.streak).toBe(1)
  })

  it('folds archived completions into XP and streak', () => {
    const archived: ArchivedCompletion[] = [{ completedAt: NOW, difficulty: 'hard' }]
    const result = deriveGamification([], NOW, archived)
    expect(result.xp).toBe(35)
    expect(result.streak).toBe(1)
  })
})

describe('computeStreak', () => {
  it('is 0 with no completions', () => {
    expect(computeStreak([], NOW)).toEqual({ streak: 0, lastCompletionDate: null })
  })

  it('counts consecutive days ending today', () => {
    const todos = [
      makeTodo({ done: true, completedAt: NOW }),
      makeTodo({ done: true, completedAt: addDays(NOW, -1) }),
      makeTodo({ done: true, completedAt: addDays(NOW, -2) }),
    ]
    const result = computeStreak(todos, NOW)
    expect(result.streak).toBe(3)
  })

  it('anchors on yesterday when nothing is completed yet today', () => {
    const todos = [makeTodo({ done: true, completedAt: addDays(NOW, -1) })]
    expect(computeStreak(todos, NOW).streak).toBe(1)
  })

  it('collapses multiple same-day completions into one streak day', () => {
    const todos = [
      makeTodo({ done: true, completedAt: NOW }),
      makeTodo({ done: true, completedAt: NOW + 60 * 60 * 1000 }),
      makeTodo({ done: true, completedAt: addDays(NOW, -1) }),
    ]
    expect(computeStreak(todos, NOW).streak).toBe(2)
  })

  it('breaks the streak across a gap but keeps the last completion date', () => {
    const gapDate = addDays(NOW, -3)
    const todos = [makeTodo({ done: true, completedAt: gapDate })]
    const result = computeStreak(todos, NOW)
    expect(result.streak).toBe(0)
    expect(result.lastCompletionDate).not.toBeNull()
  })

  it('counts an archived-only completion toward the streak', () => {
    const archived: ArchivedCompletion[] = [{ completedAt: NOW, difficulty: 'easy' }]
    expect(computeStreak([], NOW, archived).streak).toBe(1)
  })

  it('combines a live completion with an archived one from the day before', () => {
    const todos = [makeTodo({ done: true, completedAt: NOW })]
    const archived: ArchivedCompletion[] = [{ completedAt: addDays(NOW, -1), difficulty: 'easy' }]
    expect(computeStreak(todos, NOW, archived).streak).toBe(2)
  })
})

describe('xpByDay', () => {
  it('buckets XP by local day across the trailing window, oldest first', () => {
    const todos = [
      makeTodo({ difficulty: 'easy', done: true, completedAt: NOW }),
      makeTodo({ difficulty: 'hard', done: true, completedAt: addDays(NOW, -1) }),
      makeTodo({ difficulty: 'medium', done: false }),
    ]

    const result = xpByDay(todos, 3, NOW)

    expect(result).toHaveLength(3)
    expect(result.map((d) => d.xp)).toEqual([0, 35, 10])
    expect(result.at(-1)?.dateKey).toBe('2026-01-15')
  })

  it('ignores completions outside the window', () => {
    const todos = [makeTodo({ difficulty: 'easy', done: true, completedAt: addDays(NOW, -10) })]
    const result = xpByDay(todos, 3, NOW)
    expect(result.reduce((sum, d) => sum + d.xp, 0)).toBe(0)
  })

  it('folds an archived completion into its day, alongside a live todo on the same day', () => {
    const todos = [makeTodo({ difficulty: 'easy', done: true, completedAt: NOW })]
    const archived: ArchivedCompletion[] = [{ completedAt: NOW, difficulty: 'medium' }]
    const result = xpByDay(todos, 3, NOW, archived)
    expect(result.at(-1)?.xp).toBe(30)
  })
})
