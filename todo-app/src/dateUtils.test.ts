import { describe, expect, it } from 'vitest'
import {
  addDays,
  calendarDayDiff,
  formatDueLabel,
  formatRelativeTimeAgo,
  getUrgency,
  toLocalDateKey,
} from './dateUtils'
import type { Todo } from './types'

const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: '1',
    text: 'test',
    createdAt: NOW,
    difficulty: 'medium',
    done: false,
    zone: 'hector',
    ...overrides,
  }
}

describe('toLocalDateKey', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(toLocalDateKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05')
  })
})

describe('calendarDayDiff', () => {
  it('is 0 for the same calendar day at a different hour', () => {
    expect(calendarDayDiff(NOW + HOUR, NOW)).toBe(0)
  })

  it('is 1 for tomorrow and -1 for yesterday', () => {
    expect(calendarDayDiff(NOW + DAY, NOW)).toBe(1)
    expect(calendarDayDiff(NOW - DAY, NOW)).toBe(-1)
  })
})

describe('addDays', () => {
  it('moves forward/backward by whole calendar days', () => {
    expect(calendarDayDiff(addDays(NOW, 3), NOW)).toBe(3)
    expect(calendarDayDiff(addDays(NOW, -3), NOW)).toBe(-3)
  })
})

describe('formatRelativeTimeAgo', () => {
  it('handles each bucket', () => {
    expect(formatRelativeTimeAgo(NOW - 30_000, NOW)).toBe("à l'instant")
    expect(formatRelativeTimeAgo(NOW - 5 * 60_000, NOW)).toBe('il y a 5min')
    expect(formatRelativeTimeAgo(NOW - 3 * HOUR, NOW)).toBe('il y a 3h')
    expect(formatRelativeTimeAgo(NOW - 2 * DAY, NOW)).toBe('il y a 2j')
  })

  it('falls back to a short date after a week', () => {
    const fromMs = NOW - 10 * DAY
    expect(formatRelativeTimeAgo(fromMs, NOW)).toBe(
      new Date(fromMs).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    )
  })
})

describe('formatDueLabel', () => {
  it('labels today/tomorrow/yesterday', () => {
    expect(formatDueLabel(NOW, NOW)).toMatch(/^aujourd'hui /)
    expect(formatDueLabel(NOW + DAY, NOW)).toMatch(/^demain /)
    expect(formatDueLabel(NOW - DAY, NOW)).toMatch(/^hier /)
  })

  it('labels far-overdue tasks by day count', () => {
    expect(formatDueLabel(NOW - 2 * DAY, NOW)).toBe('en retard de 2 jours')
    expect(formatDueLabel(NOW - 5 * DAY, NOW)).toBe('en retard de 5 jours')
  })

  it('labels near-future days by weekday', () => {
    expect(formatDueLabel(NOW + 3 * DAY, NOW)).toMatch(/^\w{3} /)
  })

  it('falls back to a short date beyond a week out', () => {
    const dueAtMs = NOW + 10 * DAY
    expect(formatDueLabel(dueAtMs, NOW)).toBe(
      new Date(dueAtMs).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' }),
    )
  })
})

describe('getUrgency', () => {
  it('is none without a due date', () => {
    expect(getUrgency(makeTodo(), NOW)).toBe('none')
  })

  it('is overdue when due in the past', () => {
    expect(getUrgency(makeTodo({ dueAt: NOW - 1 }), NOW)).toBe('overdue')
  })

  it('is soon within 24 hours, inclusive', () => {
    expect(getUrgency(makeTodo({ dueAt: NOW + HOUR }), NOW)).toBe('soon')
    expect(getUrgency(makeTodo({ dueAt: NOW + DAY }), NOW)).toBe('soon')
  })

  it('is normal beyond 24 hours', () => {
    expect(getUrgency(makeTodo({ dueAt: NOW + DAY + 1 }), NOW)).toBe('normal')
  })
})
