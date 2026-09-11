import { useState } from 'react'
import type { SyncState } from '../hooks/useSync'

interface SyncStatusProps {
  status: SyncState
  onConnect: (code: string) => void
}

const LABELS: Record<SyncState, string> = {
  local: 'Sur cet appareil seulement',
  pending: 'Synchronisation…',
  synced: 'Synchronisé',
  offline: 'Hors ligne — les changements partiront au retour du réseau',
  'bad-key': "Code d'accès refusé",
}

/**
 * One quiet line under the zone picker. Also where a device types the shared
 * access code — needed on an installed iPhone app, which doesn't see a code
 * opened through a `#cle=` link in Safari.
 */
export function SyncStatus({ status, onConnect }: SyncStatusProps) {
  const [editing, setEditing] = useState(false)
  const [code, setCode] = useState('')
  const canConnect = status === 'local' || status === 'bad-key'

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!code.trim()) return
    onConnect(code)
    setCode('')
    setEditing(false)
  }

  if (canConnect && editing) {
    return (
      <form className="add-task-row sync-connect" onSubmit={handleSubmit}>
        <input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Code d'accès"
          aria-label="Code d'accès"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
        />
        <button type="submit">Connecter</button>
      </form>
    )
  }

  return (
    <p className={`sync-status sync-${status}`} role="status">
      {LABELS[status]}
      {canConnect && (
        <button type="button" className="sync-connect-link" onClick={() => setEditing(true)}>
          {status === 'local' ? 'Se connecter' : 'Changer de code'}
        </button>
      )}
    </p>
  )
}
