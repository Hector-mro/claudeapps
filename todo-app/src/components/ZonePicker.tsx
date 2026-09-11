import { ZONES, ZONE_LABELS, type Todo, type Zone } from '../types'

interface ZonePickerProps {
  todos: Todo[]
  onSelect: (zone: Zone) => void
}

export function ZonePicker({ todos, onSelect }: ZonePickerProps) {
  return (
    <div className="zone-picker">
      <h1>Tâches</h1>
      <p className="zone-picker-hint">Choisissez une zone</p>
      <ul className="zone-list">
        {ZONES.map((zone) => {
          const pending = todos.filter((t) => t.zone === zone && !t.done && t.parentId === undefined).length
          return (
            <li key={zone}>
              <button type="button" className="zone-button" onClick={() => onSelect(zone)}>
                <span className="zone-name">{ZONE_LABELS[zone]}</span>
                <span className="zone-count">{pending === 0 ? 'Rien en cours' : `${pending} en cours`}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
