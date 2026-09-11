import { useCallback, useEffect, useState } from 'react'
import { loadArchivedCompletions, loadTodos, saveArchivedCompletions, saveTodos } from '../storage'
import { canNest } from '../subtasks'
import type { ArchivedCompletion, Difficulty, Person, SyncSnapshot, Todo, Zone } from '../types'

interface AddTodoInput {
  text: string
  difficulty: Difficulty
  dueAt?: number
  zone: Zone
  /** Whose phone adds it (see `Todo.createdBy`); left out when the phone doesn't know. */
  createdBy?: Person
}

/** Sets `parentId`'s done state to whether all of its subtasks are done. No-op if it has none. */
function syncParentDone(todos: Todo[], parentId: string, nowMs: number): Todo[] {
  const siblings = todos.filter((t) => t.parentId === parentId)
  if (siblings.length === 0) return todos
  const allDone = siblings.every((t) => t.done)
  return todos.map((todo) =>
    todo.id === parentId && todo.done !== allDone
      ? { ...todo, done: allDone, completedAt: allDone ? nowMs : undefined }
      : todo,
  )
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos())
  const [archivedCompletions, setArchivedCompletions] = useState<ArchivedCompletion[]>(() =>
    loadArchivedCompletions(),
  )

  useEffect(() => {
    saveTodos(todos)
  }, [todos])

  useEffect(() => {
    saveArchivedCompletions(archivedCompletions)
  }, [archivedCompletions])

  function addTodo({ text, difficulty, dueAt, zone, createdBy }: AddTodoInput) {
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: trimmed,
        createdAt: Date.now(),
        dueAt,
        difficulty,
        done: false,
        zone,
        ...(createdBy ? { createdBy } : {}),
      },
    ])
  }

  function toggleTodo(id: string) {
    setTodos((prev) => {
      const target = prev.find((t) => t.id === id)
      if (!target) return prev

      const nowMs = Date.now()
      const nextDone = !target.done

      // Toggling a task also toggles its subtasks (a parent stands for the whole group).
      let next = prev.map((todo) =>
        todo.id === id || todo.parentId === id
          ? { ...todo, done: nextDone, completedAt: nextDone ? nowMs : undefined }
          : todo,
      )

      // Toggling a subtask re-derives its parent: done once every subtask is done.
      if (target.parentId) {
        next = syncParentDone(next, target.parentId, nowMs)
      }

      return next
    })
  }

  function updateTodo(id: string, updates: { text: string; difficulty: Difficulty; dueAt?: number }) {
    const trimmed = updates.text.trim()
    if (!trimmed) return
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, text: trimmed, difficulty: updates.difficulty, dueAt: updates.dueAt } : todo,
      ),
    )
  }

  function deleteTodo(id: string) {
    const toArchive = todos
      .filter((t) => (t.id === id || t.parentId === id) && t.done && t.completedAt !== undefined)
      .map((t) => ({
        id: crypto.randomUUID(),
        completedAt: t.completedAt as number,
        difficulty: t.difficulty,
        zone: t.zone,
      }))

    if (toArchive.length > 0) {
      setArchivedCompletions((prev) => [...prev, ...toArchive])
    }

    setTodos((prev) => prev.filter((todo) => todo.id !== id && todo.parentId !== id))
  }

  function nestTodo(childId: string, parentId: string) {
    setTodos((prev) => {
      if (!canNest(prev, childId, parentId)) return prev
      const next = prev.map((todo) => (todo.id === childId ? { ...todo, parentId } : todo))
      return syncParentDone(next, parentId, Date.now())
    })
  }

  /** Swaps in a whole synced state (see `useSync`). Stable across renders. */
  const replaceAll = useCallback((snapshot: SyncSnapshot) => {
    setTodos(snapshot.todos)
    setArchivedCompletions(snapshot.archived)
  }, [])

  return { todos, archivedCompletions, addTodo, toggleTodo, updateTodo, deleteTodo, nestTodo, replaceAll }
}
