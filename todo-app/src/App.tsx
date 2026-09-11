import { useMemo, useState } from 'react'
import './App.css'
import { AddTaskForm } from './components/AddTaskForm'
import { ProgressHeader } from './components/ProgressHeader'
import { StatsPage } from './components/StatsPage'
import { SyncStatus } from './components/SyncStatus'
import { TaskList } from './components/TaskList'
import { ZonePicker } from './components/ZonePicker'
import { useGamification } from './hooks/useGamification'
import { useSync } from './hooks/useSync'
import { useTodos } from './hooks/useTodos'
import { ZONE_LABELS, type Zone } from './types'

function App() {
  const { todos, archivedCompletions, addTodo, toggleTodo, updateTodo, deleteTodo, nestTodo, replaceAll } =
    useTodos()
  const sync = useSync({ todos, archivedCompletions, replaceAll })
  const [zone, setZone] = useState<Zone | null>(null)
  const [view, setView] = useState<'tasks' | 'stats'>('tasks')

  // Everything below the zone picker only ever sees the open zone's tasks and XP.
  const zoneTodos = useMemo(() => todos.filter((t) => t.zone === zone), [todos, zone])
  const zoneArchived = useMemo(
    () => archivedCompletions.filter((a) => a.zone === zone),
    [archivedCompletions, zone],
  )
  const gamification = useGamification(zoneTodos, zoneArchived)

  function openZone(next: Zone) {
    setZone(next)
    setView('tasks')
  }

  if (zone === null) {
    return (
      <main className="app">
        <ZonePicker todos={todos} onSelect={openZone} />
        <SyncStatus status={sync.status} onConnect={sync.connect} />
      </main>
    )
  }

  const zoneLabel = ZONE_LABELS[zone]

  if (view === 'stats') {
    return (
      <main className="app">
        <StatsPage
          todos={zoneTodos}
          archivedCompletions={zoneArchived}
          gamification={gamification}
          backLabel={zoneLabel}
          onBack={() => setView('tasks')}
        />
      </main>
    )
  }

  return (
    <main className="app">
      <ProgressHeader
        {...gamification}
        zoneLabel={zoneLabel}
        onChangeZone={() => setZone(null)}
        onOpenStats={() => setView('stats')}
      />
      <AddTaskForm onAdd={(input) => addTodo({ ...input, zone })} />
      <TaskList todos={zoneTodos} onToggle={toggleTodo} onUpdate={updateTodo} onDelete={deleteTodo} onNest={nestTodo} />
    </main>
  )
}

export default App
