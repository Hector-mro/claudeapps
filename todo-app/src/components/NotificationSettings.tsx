import { useState } from 'react'
import type { NotificationStatus } from '../hooks/useNotifications'
import { PERSONS, ZONE_LABELS, type Person } from '../types'

interface NotificationSettingsProps {
  status: NotificationStatus
  person: Person | null
  onEnable: (person: Person) => void
  onDisable: () => void
}

/**
 * One quiet line under the sync status: turns this phone's notifications on or off.
 * Turning them on first asks whose phone it is — each person hears about their own
 * zone and the shared one.
 */
export function NotificationSettings({ status, person, onEnable, onDisable }: NotificationSettingsProps) {
  const [choosing, setChoosing] = useState(false)

  if (status === 'hidden') return null

  if (status === 'needs-install') {
    return <p className="sync-status">Pour les notifications, ajoute l'app à l'écran d'accueil</p>
  }

  if (status === 'denied') {
    return <p className="sync-status">Notifications refusées — Réglages › Notifications › Tâches</p>
  }

  if (status === 'busy') {
    return (
      <p className="sync-status" role="status">
        Notifications…
      </p>
    )
  }

  if (status === 'on') {
    return (
      <p className="sync-status">
        Notifications activées{person && ` · ${ZONE_LABELS[person]}`}
        <button type="button" className="sync-connect-link" onClick={onDisable}>
          Désactiver
        </button>
      </p>
    )
  }

  if (choosing) {
    return (
      <p className="sync-status">
        C'est qui ?
        {PERSONS.map((p) => (
          <button
            key={p}
            type="button"
            className="sync-connect-link"
            onClick={() => {
              setChoosing(false)
              onEnable(p)
            }}
          >
            {ZONE_LABELS[p]}
          </button>
        ))}
      </p>
    )
  }

  return (
    <p className="sync-status">
      {status === 'failed' && "L'activation n'a pas abouti."}
      <button type="button" className="sync-connect-link" onClick={() => setChoosing(true)}>
        {status === 'failed' ? 'Réessayer' : 'Activer les notifications'}
      </button>
    </p>
  )
}
