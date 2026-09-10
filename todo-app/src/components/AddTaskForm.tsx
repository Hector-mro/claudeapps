import { useState } from 'react'
import type { Difficulty } from '../types'

interface AddTaskFormProps {
  onAdd: (input: { text: string; difficulty: Difficulty; dueAt?: number }) => void
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
]

export function AddTaskForm({ onAdd }: AddTaskFormProps) {
  const [text, setText] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [dueAtLocal, setDueAtLocal] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return

    const dueAt = dueAtLocal ? new Date(dueAtLocal).getTime() : undefined
    onAdd({ text: trimmed, difficulty, dueAt })

    setText('')
    setDifficulty('medium')
    setDueAtLocal('')
  }

  return (
    <form className="add-task-form" onSubmit={handleSubmit}>
      <div className="add-task-row">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Que faut-il faire ?"
          aria-label="Nouvelle tâche"
        />
        <button
          type="button"
          className="details-toggle"
          aria-label="Ajouter des détails"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen((open) => !open)}
        >
          +
        </button>
        <button type="submit">Ajouter</button>
      </div>

      {detailsOpen && (
        <div className="add-task-details">
          <div className="difficulty-group" role="radiogroup" aria-label="Difficulté">
            {DIFFICULTIES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={difficulty === value}
                className={`difficulty-option${difficulty === value ? ' selected' : ''}`}
                onClick={() => setDifficulty(value)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="due-input-row">
            <input
              type="datetime-local"
              aria-label="Échéance"
              value={dueAtLocal}
              onChange={(event) => setDueAtLocal(event.target.value)}
            />
            {dueAtLocal && (
              <button type="button" aria-label="Effacer l'échéance" onClick={() => setDueAtLocal('')}>
                ×
              </button>
            )}
          </div>
        </div>
      )}
    </form>
  )
}
