import { useState } from 'react'
import type { Todo } from './types'
import './App.css'

function App() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [text, setText] = useState('')

  function addTodo(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos((prev) => [...prev, { id: crypto.randomUUID(), text: trimmed, done: false }])
    setText('')
  }

  function toggleTodo(id: string) {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    )
  }

  function deleteTodo(id: string) {
    setTodos((prev) => prev.filter((todo) => todo.id !== id))
  }

  return (
    <main className="app">
      <h1>Todo</h1>
      <form onSubmit={addTodo}>
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="What needs doing?"
          aria-label="New todo"
        />
        <button type="submit">Add</button>
      </form>
      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id} className={todo.done ? 'done' : ''}>
            <label>
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => toggleTodo(todo.id)}
              />
              {todo.text}
            </label>
            <button type="button" onClick={() => deleteTodo(todo.id)} aria-label={`Delete ${todo.text}`}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

export default App
