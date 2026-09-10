import { useState } from 'react'
import type { Difficulty, Todo } from '../types'
import { DifficultyPicker, DueDatePicker } from './TaskFields'

interface EditTaskFormProps {
  todo: Todo
  onSave: (updates: { text: string; difficulty: Difficulty; dueAt?: number }) => void
  onCancel: () => void
}

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function EditTaskForm({ todo, onSave, onCancel }: EditTaskFormProps) {
  const [text, setText] = useState(todo.text)
  const [difficulty, setDifficulty] = useState<Difficulty>(todo.difficulty)
  const [dueAtLocal, setDueAtLocal] = useState(todo.dueAt !== undefined ? toDatetimeLocalValue(todo.dueAt) : '')

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    const dueAt = dueAtLocal ? new Date(dueAtLocal).getTime() : undefined
    onSave({ text: trimmed, difficulty, dueAt })
  }

  return (
    <form className="edit-task-form" onSubmit={handleSubmit}>
      <input
        type="text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-label="Modifier le texte de la tâche"
        autoFocus
      />
      <DifficultyPicker value={difficulty} onChange={setDifficulty} />
      <DueDatePicker value={dueAtLocal} onChange={setDueAtLocal} />
      <div className="edit-task-actions">
        <button type="submit">Enregistrer</button>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  )
}
