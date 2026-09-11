import { describe, expect, it } from 'vitest'
import { groupAndSortTodos } from './todoSort'
import type { Todo } from './types'

const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: Math.random().toString(36),
    text: 'test',
    createdAt: NOW,
    difficulty: 'medium',
    done: false,
    zone: 'hector',
    ...overrides,
  }
}

describe('groupAndSortTodos', () => {
  it('buckets and orders todos by urgency and completion', () => {
    const overdueOld = makeTodo({ text: 'overdue-old', dueAt: NOW - 2 * DAY })
    const overdueRecent = makeTodo({ text: 'overdue-recent', dueAt: NOW - HOUR })
    const soon = makeTodo({ text: 'soon', dueAt: NOW + HOUR })
    const upcoming = makeTodo({ text: 'upcoming', dueAt: NOW + 3 * DAY })
    const noDateFirst = makeTodo({ text: 'no-date-first', createdAt: NOW - HOUR })
    const noDateSecond = makeTodo({ text: 'no-date-second', createdAt: NOW })
    const doneOld = makeTodo({ text: 'done-old', done: true, completedAt: NOW - DAY })
    const doneRecent = makeTodo({ text: 'done-recent', done: true, completedAt: NOW })

    const groups = groupAndSortTodos(
      [upcoming, doneOld, noDateSecond, overdueRecent, doneRecent, soon, overdueOld, noDateFirst],
      NOW,
    )

    expect(groups.overdue.map((t) => t.text)).toEqual(['overdue-old', 'overdue-recent'])
    expect(groups.dueSoon.map((t) => t.text)).toEqual(['soon'])
    expect(groups.upcoming.map((t) => t.text)).toEqual(['upcoming'])
    expect(groups.noDate.map((t) => t.text)).toEqual(['no-date-first', 'no-date-second'])
    expect(groups.done.map((t) => t.text)).toEqual(['done-recent', 'done-old'])
  })

  it('returns empty buckets for an empty list', () => {
    const groups = groupAndSortTodos([], NOW)
    expect(groups).toEqual({ overdue: [], dueSoon: [], upcoming: [], noDate: [], done: [] })
  })
})
