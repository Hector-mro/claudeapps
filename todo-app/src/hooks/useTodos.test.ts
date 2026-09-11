import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useTodos } from './useTodos'

describe('useTodos subtasks', () => {
  it('nests a task under another and marks the parent done once all subtasks are done', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child', difficulty: 'easy', zone: 'hector' }))

    const [parent, child] = result.current.todos
    act(() => result.current.nestTodo(child.id, parent.id))

    expect(result.current.todos.find((t) => t.id === child.id)?.parentId).toBe(parent.id)

    act(() => result.current.toggleTodo(child.id))

    expect(result.current.todos.find((t) => t.id === parent.id)?.done).toBe(true)
  })

  it('un-completes the parent when a completed subtask is toggled back off', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child', difficulty: 'easy', zone: 'hector' }))
    const [parent, child] = result.current.todos
    act(() => result.current.nestTodo(child.id, parent.id))
    act(() => result.current.toggleTodo(child.id))
    expect(result.current.todos.find((t) => t.id === parent.id)?.done).toBe(true)

    act(() => result.current.toggleTodo(child.id))

    expect(result.current.todos.find((t) => t.id === parent.id)?.done).toBe(false)
  })

  it('does not mark the parent done until every subtask is done', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child A', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child B', difficulty: 'easy', zone: 'hector' }))
    const [parent, childA, childB] = result.current.todos
    act(() => result.current.nestTodo(childA.id, parent.id))
    act(() => result.current.nestTodo(childB.id, parent.id))

    act(() => result.current.toggleTodo(childA.id))

    expect(result.current.todos.find((t) => t.id === parent.id)?.done).toBe(false)
  })

  it('toggling a parent cascades to all of its subtasks', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child', difficulty: 'easy', zone: 'hector' }))
    const [parent, child] = result.current.todos
    act(() => result.current.nestTodo(child.id, parent.id))

    act(() => result.current.toggleTodo(parent.id))

    expect(result.current.todos.find((t) => t.id === child.id)?.done).toBe(true)

    act(() => result.current.toggleTodo(parent.id))

    expect(result.current.todos.find((t) => t.id === child.id)?.done).toBe(false)
  })

  it('deleting a parent deletes its subtasks too', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child', difficulty: 'easy', zone: 'hector' }))
    const [parent, child] = result.current.todos
    act(() => result.current.nestTodo(child.id, parent.id))

    act(() => result.current.deleteTodo(parent.id))

    expect(result.current.todos).toHaveLength(0)
  })

  it('banks XP for a done task when it is deleted', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Task', difficulty: 'hard', zone: 'hector' }))
    const [task] = result.current.todos
    act(() => result.current.toggleTodo(task.id))

    act(() => result.current.deleteTodo(task.id))

    expect(result.current.todos).toHaveLength(0)
    expect(result.current.archivedCompletions).toEqual([
      { id: expect.any(String), completedAt: expect.any(Number), difficulty: 'hard', zone: 'hector' },
    ])
  })

  it('banks nothing when a not-done task is deleted', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Task', difficulty: 'easy', zone: 'hector' }))
    const [task] = result.current.todos

    act(() => result.current.deleteTodo(task.id))

    expect(result.current.archivedCompletions).toEqual([])
  })

  it('banks the parent and each done subtask when a parent deletion cascades', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child', difficulty: 'medium', zone: 'hector' }))
    const [parent, child] = result.current.todos
    act(() => result.current.nestTodo(child.id, parent.id))
    act(() => result.current.toggleTodo(child.id))

    act(() => result.current.deleteTodo(parent.id))

    expect(result.current.archivedCompletions).toHaveLength(2)
    expect(result.current.archivedCompletions.map((a) => a.difficulty).sort()).toEqual(['easy', 'medium'])
  })

  it('banks XP for a done subtask deleted directly', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Parent', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'Child', difficulty: 'medium', zone: 'hector' }))
    const [parent, child] = result.current.todos
    act(() => result.current.nestTodo(child.id, parent.id))
    act(() => result.current.toggleTodo(child.id))

    act(() => result.current.deleteTodo(child.id))

    expect(result.current.archivedCompletions).toEqual([
      { id: expect.any(String), completedAt: expect.any(Number), difficulty: 'medium', zone: 'hector' },
    ])
  })

  it('refuses to nest beyond two levels or onto/around invalid targets', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'A', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'B', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'C', difficulty: 'easy', zone: 'hector' }))
    const [a, b, c] = result.current.todos

    act(() => result.current.nestTodo(b.id, a.id))
    // b is now a subtask of a; nesting c under b would create a third level
    act(() => result.current.nestTodo(c.id, b.id))
    expect(result.current.todos.find((t) => t.id === c.id)?.parentId).toBeUndefined()

    // a already has a subtask (b); nesting a under c is blocked
    act(() => result.current.nestTodo(a.id, c.id))
    expect(result.current.todos.find((t) => t.id === a.id)?.parentId).toBeUndefined()
  })
})

describe('useTodos zones', () => {
  it('files a new task under the zone it was added in', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Courses', difficulty: 'easy', zone: 'commun' }))

    expect(result.current.todos[0].zone).toBe('commun')
  })

  it('banks a deleted done task under its own zone', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'Task', difficulty: 'easy', zone: 'nina' }))
    const [task] = result.current.todos
    act(() => result.current.toggleTodo(task.id))
    act(() => result.current.deleteTodo(task.id))

    expect(result.current.archivedCompletions).toEqual([
      { id: expect.any(String), completedAt: expect.any(Number), difficulty: 'easy', zone: 'nina' },
    ])
  })

  it('refuses to nest a task under one from another zone', () => {
    const { result } = renderHook(() => useTodos())

    act(() => result.current.addTodo({ text: 'A', difficulty: 'easy', zone: 'hector' }))
    act(() => result.current.addTodo({ text: 'B', difficulty: 'easy', zone: 'nina' }))
    const [a, b] = result.current.todos

    act(() => result.current.nestTodo(b.id, a.id))

    expect(result.current.todos.find((t) => t.id === b.id)?.parentId).toBeUndefined()
  })
})
