import './App.css'
import { AddTaskForm } from './components/AddTaskForm'
import { ProgressHeader } from './components/ProgressHeader'
import { TaskList } from './components/TaskList'
import { useGamification } from './hooks/useGamification'
import { useTodos } from './hooks/useTodos'

function App() {
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos()
  const gamification = useGamification(todos)

  return (
    <main className="app">
      <ProgressHeader {...gamification} />
      <AddTaskForm onAdd={addTodo} />
      <TaskList todos={todos} onToggle={toggleTodo} onDelete={deleteTodo} />
    </main>
  )
}

export default App
