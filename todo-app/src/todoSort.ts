import { getUrgency } from './dateUtils'
import type { Todo } from './types'

export interface TodoGroups {
  overdue: Todo[]
  dueSoon: Todo[]
  upcoming: Todo[]
  noDate: Todo[]
  done: Todo[]
}

export function groupAndSortTodos(todos: Todo[], nowMs: number = Date.now()): TodoGroups {
  const groups: TodoGroups = { overdue: [], dueSoon: [], upcoming: [], noDate: [], done: [] }

  for (const todo of todos) {
    if (todo.parentId !== undefined) continue // subtasks render nested under their parent

    if (todo.done) {
      groups.done.push(todo)
      continue
    }

    switch (getUrgency(todo, nowMs)) {
      case 'overdue':
        groups.overdue.push(todo)
        break
      case 'soon':
        groups.dueSoon.push(todo)
        break
      case 'normal':
        groups.upcoming.push(todo)
        break
      case 'none':
        groups.noDate.push(todo)
        break
    }
  }

  groups.overdue.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
  groups.dueSoon.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
  groups.upcoming.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0))
  groups.noDate.sort((a, b) => a.createdAt - b.createdAt)
  groups.done.sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))

  return groups
}
