import type { Todo } from './types'

const STORAGE_KEY = 'todo-app:v1'

function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) return false
  const t = value as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.text === 'string' &&
    typeof t.createdAt === 'number' &&
    typeof t.done === 'boolean' &&
    (t.difficulty === 'easy' || t.difficulty === 'medium' || t.difficulty === 'hard')
  )
}

export function loadTodos(): Todo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isTodo)
  } catch {
    return []
  }
}

export function saveTodos(todos: Todo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  } catch {
    // Storage disabled or full — app continues to work in-memory for this session.
  }
}
