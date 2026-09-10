import { useEffect, useState } from 'react'
import { loadTodos, saveTodos } from '../storage'
import type { Difficulty, Todo } from '../types'

interface AddTodoInput {
  text: string
  difficulty: Difficulty
  dueAt?: number
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>(() => loadTodos())

  useEffect(() => {
    saveTodos(todos)
  }, [todos])

  function addTodo({ text, difficulty, dueAt }: AddTodoInput) {
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
      },
    ])
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id
          ? {
              ...todo,
              done: !todo.done,
              completedAt: !todo.done ? Date.now() : undefined,
            }
          : todo,
      ),
    )
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id))
  }

  return { todos, addTodo, toggleTodo, deleteTodo }
}
