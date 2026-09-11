import { useState } from 'react'
import './App.css'
import { AddTaskForm } from './components/AddTaskForm'
import { ProgressHeader } from './components/ProgressHeader'
import { StatsPage } from './components/StatsPage'
import { TaskList } from './components/TaskList'
import { useGamification } from './hooks/useGamification'
import { useTodos } from './hooks/useTodos'

function App() {
  const { todos, archivedCompletions, addTodo, toggleTodo, updateTodo, deleteTodo, nestTodo } = useTodos()
  const gamification = useGamification(todos, archivedCompletions)
  const [view, setView] = useState<'tasks' | 'stats'>('tasks')

  if (view === 'stats') {
    return (
      <main className="app">
        <StatsPage
          todos={todos}
          archivedCompletions={archivedCompletions}
          gamification={gamification}
          onBack={() => setView('tasks')}
        />
      </main>
    )
  }

  return (
    <main className="app">
      <ProgressHeader {...gamification} onOpenStats={() => setView('stats')} />
      <AddTaskForm onAdd={addTodo} />
      <TaskList todos={todos} onToggle={toggleTodo} onUpdate={updateTodo} onDelete={deleteTodo} onNest={nestTodo} />
    </main>
  )
}

export default App
