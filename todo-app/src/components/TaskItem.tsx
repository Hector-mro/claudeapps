import { formatDueLabel, formatRelativeTimeAgo, getUrgency } from '../dateUtils'
import type { Difficulty, Todo } from '../types'

interface TaskItemProps {
  todo: Todo
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  now: number
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

export function TaskItem({ todo, onToggle, onDelete, now }: TaskItemProps) {
  const urgency = getUrgency(todo, now)

  return (
    <li className={todo.done ? 'done' : ''}>
      <label>
        <input type="checkbox" checked={todo.done} onChange={() => onToggle(todo.id)} />
        <span className="task-text">{todo.text}</span>
      </label>
      <div className="task-meta">
        <DifficultyDots difficulty={todo.difficulty} />
        {todo.dueAt !== undefined && (
          <span className={`due-badge urgency-${urgency}`}>{formatDueLabel(todo.dueAt, now)}</span>
        )}
        <span className="created-caption">ajouté {formatRelativeTimeAgo(todo.createdAt, now)}</span>
      </div>
      <button type="button" onClick={() => onDelete(todo.id)} aria-label={`Supprimer ${todo.text}`}>
        Supprimer
      </button>
    </li>
  )
}
