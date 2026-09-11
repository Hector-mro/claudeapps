import { describe, expect, it } from 'vitest'
import { canNest, getSubtasks, hasSubtasks } from './subtasks'
import type { Todo } from './types'

function makeTodo(overrides: Partial<Todo>): Todo {
  return {
    id: Math.random().toString(36),
    text: 'test',
    createdAt: 0,
    difficulty: 'medium',
    done: false,
    zone: 'hector',
    ...overrides,
  }
}

describe('getSubtasks', () => {
  it('returns only direct children, oldest first', () => {
    const parent = makeTodo({ id: 'p' })
    const childB = makeTodo({ id: 'b', parentId: 'p', createdAt: 2 })
    const childA = makeTodo({ id: 'a', parentId: 'p', createdAt: 1 })
    const unrelated = makeTodo({ id: 'x' })

    expect(getSubtasks([parent, childB, childA, unrelated], 'p').map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('hasSubtasks', () => {
  it('is true only when a todo has children', () => {
    const parent = makeTodo({ id: 'p' })
    const child = makeTodo({ id: 'c', parentId: 'p' })
    expect(hasSubtasks([parent, child], 'p')).toBe(true)
    expect(hasSubtasks([parent, child], 'c')).toBe(false)
  })
})

describe('canNest', () => {
  it('allows nesting a plain top-level task under another', () => {
    const a = makeTodo({ id: 'a' })
    const b = makeTodo({ id: 'b' })
    expect(canNest([a, b], 'a', 'b')).toBe(true)
  })

  it('rejects nesting a task onto itself', () => {
    const a = makeTodo({ id: 'a' })
    expect(canNest([a], 'a', 'a')).toBe(false)
  })

  it('rejects nesting under a task that is already a subtask (max two levels)', () => {
    const grandparent = makeTodo({ id: 'gp' })
    const parent = makeTodo({ id: 'p', parentId: 'gp' })
    const leaf = makeTodo({ id: 'l' })
    expect(canNest([grandparent, parent, leaf], 'l', 'p')).toBe(false)
  })

  it('rejects nesting a task that already has subtasks of its own', () => {
    const a = makeTodo({ id: 'a' })
    const aChild = makeTodo({ id: 'ac', parentId: 'a' })
    const b = makeTodo({ id: 'b' })
    expect(canNest([a, aChild, b], 'a', 'b')).toBe(false)
  })

  it('rejects nesting a task that is already a subtask', () => {
    const parent = makeTodo({ id: 'p' })
    const child = makeTodo({ id: 'c', parentId: 'p' })
    const other = makeTodo({ id: 'o' })
    expect(canNest([parent, child, other], 'c', 'o')).toBe(false)
  })

  it('rejects nesting onto a completed task', () => {
    const a = makeTodo({ id: 'a' })
    const b = makeTodo({ id: 'b', done: true })
    expect(canNest([a, b], 'a', 'b')).toBe(false)
  })

  it('rejects nesting across zones', () => {
    const a = makeTodo({ id: 'a', zone: 'hector' })
    const b = makeTodo({ id: 'b', zone: 'nina' })
    expect(canNest([a, b], 'a', 'b')).toBe(false)
  })
})
