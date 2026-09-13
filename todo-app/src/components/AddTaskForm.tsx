import { useState } from 'react'
import { parseTaskInput } from '../taskInput'
import type { Difficulty } from '../types'
import { DifficultyPicker, DueDatePicker } from './TaskFields'

interface AddTaskFormProps {
  onAdd: (input: { text: string; difficulty: Difficulty; dueAt?: number }) => void
}

export function AddTaskForm({ onAdd }: AddTaskFormProps) {
  const [text, setText] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [dueAtLocal, setDueAtLocal] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    // The text may also carry a difficulty and a due date — « monter l'étagère, moyen,
    // demain ». Whatever the pickers say explicitly wins over what the text implies,
    // since the pickers are the half the user can actually see; the details panel is
    // collapsed by default, so an untouched difficulty still reads as 'medium'.
    const parsed = parseTaskInput(text)
    if (!parsed.text) return

    const pickedDueAt = dueAtLocal ? new Date(dueAtLocal).getTime() : undefined
    onAdd({
      text: parsed.text,
      difficulty: difficulty !== 'medium' ? difficulty : (parsed.difficulty ?? 'medium'),
      dueAt: pickedDueAt ?? parsed.dueAt,
    })

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
          <DifficultyPicker value={difficulty} onChange={setDifficulty} />
          <DueDatePicker value={dueAtLocal} onChange={setDueAtLocal} />
        </div>
      )}
    </form>
  )
}
