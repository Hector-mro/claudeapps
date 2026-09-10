import { useState } from 'react'
import { canNest, getSubtasks } from '../subtasks'
import { groupAndSortTodos, type TodoGroups } from '../todoSort'
import type { Difficulty, Todo } from '../types'
import { TaskItem } from './TaskItem'

interface TaskListProps {
  todos: Todo[]
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: { text: string; difficulty: Difficulty; dueAt?: number }) => void
  onDelete: (id: string) => void
  onNest: (childId: string, parentId: string) => void
}

const SECTIONS: Array<{ key: keyof Omit<TodoGroups, 'done'>; label: string }> = [
  { key: 'overdue', label: 'En retard' },
  { key: 'dueSoon', label: 'Bientôt' },
  { key: 'upcoming', label: 'À venir' },
  { key: 'noDate', label: 'Sans échéance' },
]

interface DragState {
  id: string
  text: string
  pointerId: number
  x: number
  y: number
  overId: string | null
}

export function TaskList({ todos, onToggle, onUpdate, onDelete, onNest }: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)
  const now = Date.now()
  const groups = groupAndSortTodos(todos, now)

  function handleHandlePointerMove(event: React.PointerEvent) {
    if (!drag || drag.pointerId !== event.pointerId) return
    const el = document.elementFromPoint(event.clientX, event.clientY)
    const targetLi = el?.closest<HTMLElement>('[data-todo-id]')
    const overId = targetLi?.dataset.todoId ?? null
    setDrag({ ...drag, x: event.clientX, y: event.clientY, overId })
  }

  function handleHandlePointerUp(event: React.PointerEvent) {
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.overId && canNest(todos, drag.id, drag.overId)) {
      onNest(drag.id, drag.overId)
    }
    setDrag(null)
  }

  function handleHandlePointerCancel(event: React.PointerEvent) {
    if (drag?.pointerId === event.pointerId) setDrag(null)
  }

  const dragHandlers = {
    onPointerDown: (event: React.PointerEvent, id: string) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const text = todos.find((t) => t.id === id)?.text ?? ''
      setDrag({ id, text, pointerId: event.pointerId, x: event.clientX, y: event.clientY, overId: null })
    },
    onPointerMove: handleHandlePointerMove,
    onPointerUp: handleHandlePointerUp,
    onPointerCancel: handleHandlePointerCancel,
  }

  if (todos.length === 0) {
    return <p className="empty-state">Rien sur votre liste. Ajoutez quelque chose ci-dessus.</p>
  }

  function renderTask(todo: Todo, draggable: boolean) {
    const subtasks = getSubtasks(todos, todo.id)
    const isDragTarget = drag !== null && drag.id !== todo.id && drag.overId === todo.id
    return (
      <TaskItem
        key={todo.id}
        todo={todo}
        subtasks={subtasks}
        onToggle={onToggle}
        onUpdate={onUpdate}
        onDelete={onDelete}
        now={now}
        draggable={draggable && subtasks.length === 0 && !todo.done}
        isDragging={drag?.id === todo.id}
        dropState={isDragTarget ? (canNest(todos, drag!.id, todo.id) ? 'valid' : 'invalid') : undefined}
        dragHandlers={dragHandlers}
      />
    )
  }

  return (
    <div className="task-list">
      {SECTIONS.map(({ key, label }) => {
        const items = groups[key]
        if (items.length === 0) return null
        return (
          <section key={key} className="task-section">
            <h2>{label}</h2>
            <ul className="todo-list">{items.map((todo) => renderTask(todo, true))}</ul>
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
          {showCompleted && <ul className="todo-list">{groups.done.map((todo) => renderTask(todo, false))}</ul>}
        </section>
      )}

      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {drag.text}
        </div>
      )}
    </div>
  )
}
