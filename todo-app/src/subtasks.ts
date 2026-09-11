import type { Todo } from './types'

/** Direct children of `parentId`, in creation order. */
export function getSubtasks(todos: Todo[], parentId: string): Todo[] {
  return todos.filter((t) => t.parentId === parentId).sort((a, b) => a.createdAt - b.createdAt)
}

export function hasSubtasks(todos: Todo[], id: string): boolean {
  return todos.some((t) => t.parentId === id)
}

/**
 * Whether `childId` can be dropped onto `parentId` to become a subtask.
 * Nesting is capped at two levels: a subtask can't itself gain subtasks,
 * and a task that already has subtasks can't be nested under another one.
 * Both tasks must live in the same zone.
 */
export function canNest(todos: Todo[], childId: string, parentId: string): boolean {
  if (childId === parentId) return false
  const child = todos.find((t) => t.id === childId)
  const parent = todos.find((t) => t.id === parentId)
  if (!child || !parent) return false
  if (child.zone !== parent.zone) return false
  if (child.parentId) return false
  if (parent.parentId) return false
  if (parent.done) return false
  if (hasSubtasks(todos, childId)) return false
  return true
}
