import { DIFFICULTY_OPTIONS, type Difficulty } from '../types'

interface DifficultyPickerProps {
  value: Difficulty
  onChange: (value: Difficulty) => void
}

export function DifficultyPicker({ value, onChange }: DifficultyPickerProps) {
  return (
    <div className="difficulty-group" role="radiogroup" aria-label="Difficulté">
      {DIFFICULTY_OPTIONS.map(({ value: option, label }) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          className={`difficulty-option${value === option ? ' selected' : ''}`}
          onClick={() => onChange(option)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

interface DueDatePickerProps {
  value: string
  onChange: (value: string) => void
}

export function DueDatePicker({ value, onChange }: DueDatePickerProps) {
  return (
    <div className="due-input-row">
      <input type="datetime-local" aria-label="Échéance" value={value} onChange={(event) => onChange(event.target.value)} />
      {value && (
        <button type="button" aria-label="Effacer l'échéance" onClick={() => onChange('')}>
          ×
        </button>
      )}
    </div>
  )
}
