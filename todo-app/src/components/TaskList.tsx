import { useState } from 'react'
import { groupAndSortTodos, type TodoGroups } from '../todoSort'
import type { Todo } from '../types'
import { TaskItem } from './TaskItem'

interface TaskListProps {
  todos: Todo[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}

const SECTIONS: Array<{ key: keyof Omit<TodoGroups, 'done'>; label: string }> = [
  { key: 'overdue', label: 'En retard' },
  { key: 'dueSoon', label: 'Bientôt' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'noDate', label: 'Sans échéance' },
]

export function TaskList({ todos, onToggle, onDelete }: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(true)
  const now = Date.now()
  const groups = groupAndSortTodos(todos, now)

  if (todos.length === 0) {
    return <p className="empty-state">Rien sur votre liste. Ajoutez quelque chose ci-dessus.</p>
  }

  return (
    <div className="task-list">
      {SECTIONS.map(({ key, label }) => {
        const items = groups[key]
        if (items.length === 0) return null
        return (
          <section key={key} className="task-section">
            <h2>{label}</h2>
            <ul className="todo-list">
              {items.map((todo) => (
                <TaskItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} now={now} />
              ))}
            </ul>
          </section>
        )
      })}

      {groups.done.length > 0 && (
        <section className="task-section done-section">
          <button
            type="button"
            className="toggle-completed"
            onClick={() => setShowCompleted((open) => !open)}
            aria-expanded={showCompleted}
          >
            {showCompleted ? 'Masquer' : 'Afficher'} les tâches terminées ({groups.done.length})
          </button>
          {showCompleted && (
            <ul className="todo-list">
              {groups.done.map((todo) => (
                <TaskItem key={todo.id} todo={todo} onToggle={onToggle} onDelete={onDelete} now={now} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
