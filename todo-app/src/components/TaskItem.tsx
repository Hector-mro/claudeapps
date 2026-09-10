import { useState } from 'react'
import { formatDueLabel, formatRelativeTimeAgo, getUrgency } from '../dateUtils'
import type { Difficulty, Todo } from '../types'
import { EditTaskForm } from './EditTaskForm'

export interface DragHandlers {
  onPointerDown: (event: React.PointerEvent, id: string) => void
  onPointerMove: (event: React.PointerEvent) => void
  onPointerUp: (event: React.PointerEvent) => void
  onPointerCancel: (event: React.PointerEvent) => void
}

interface TaskItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onUpdate: (id: string, updates: { text: string; difficulty: Difficulty; dueAt?: number }) => void
  onDelete: (id: string) => void
  now: number
  subtasks?: Todo[]
  isSubtask?: boolean
  draggable?: boolean
  isDragging?: boolean
  dropState?: 'valid' | 'invalid'
  dragHandlers?: DragHandlers
}

const DIFFICULTY_LEVEL: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }
const DIFFICULTY_LABEL_FR: Record<Difficulty, string> = {
  easy: 'facile',
  medium: 'moyenne',
  hard: 'difficile',
}

function DifficultyDots({ difficulty }: { difficulty: Difficulty }) {
  const level = DIFFICULTY_LEVEL[difficulty]
  return (
    <span className="difficulty-dots" aria-label={`Difficulté : ${DIFFICULTY_LABEL_FR[difficulty]}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={`dot${i <= level ? ' filled' : ''}`} />
      ))}
    </span>
  )
}

export function TaskItem({
  todo,
  onToggle,
  onUpdate,
  onDelete,
  now,
  subtasks,
  isSubtask,
  draggable,
  isDragging,
  dropState,
  dragHandlers,
}: TaskItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const urgency = getUrgency(todo, now)
  const doneCount = subtasks?.filter((t) => t.done).length ?? 0

  const classNames = [
    todo.done ? 'done' : '',
    isSubtask ? 'subtask' : '',
    isDragging ? 'dragging' : '',
    dropState ? `drop-target-${dropState}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (isEditing) {
    return (
      <li className={classNames} data-todo-id={todo.id}>
        <EditTaskForm
          todo={todo}
          onSave={(updates) => {
            onUpdate(todo.id, updates)
            setIsEditing(false)
          }}
          onCancel={() => setIsEditing(false)}
        />
      </li>
    )
  }

  return (
    <li className={classNames} data-todo-id={todo.id}>
      <div className="task-row">
        <label className="task-toggle">
          <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
          <span className="task-text">{todo.text}</span>
        </label>
        <div className="task-row-actions">
          {draggable && (
            <button
              type="button"
              className="icon-button drag-handle"
              aria-label={`Réorganiser ${todo.text}`}
              onPointerDown={(event) => dragHandlers?.onPointerDown(event, todo.id)}
              onPointerMove={dragHandlers?.onPointerMove}
              onPointerUp={dragHandlers?.onPointerUp}
              onPointerCancel={dragHandlers?.onPointerCancel}
            >
              ⠿
            </button>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={`Modifier ${todo.text}`}
            onClick={() => setIsEditing(true)}
          >
            ✎
          </button>
          <button type="button" className="icon-button" onClick={() => onDelete(todo.id)} aria-label={`Supprimer ${todo.text}`}>
            🗑
          </button>
        </div>
      </div>
      <div className="task-meta">
        <DifficultyDots difficulty={todo.difficulty} />
        {todo.dueAt !== undefined && (
          <span className={`due-badge urgency-${urgency}`}>{formatDueLabel(todo.dueAt, now)}</span>
        )}
        {subtasks && subtasks.length > 0 && (
          <span className="subtask-progress">
            {doneCount}/{subtasks.length} sous-tâches
          </span>
        )}
        <span className="created-caption">ajouté {formatRelativeTimeAgo(todo.createdAt, now)}</span>
      </div>

      {subtasks && subtasks.length > 0 && (
        <ul className="subtask-list">
          {subtasks.map((subtask) => (
            <TaskItem
              key={subtask.id}
              todo={subtask}
              onToggle={onToggle}
              onUpdate={onUpdate}
              onDelete={onDelete}
              now={now}
              isSubtask
            />
          ))}
        </ul>
      )}
    </li>
  )
}
