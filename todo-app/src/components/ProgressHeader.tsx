import type { GamificationSnapshot } from '../types'

interface ProgressHeaderProps extends GamificationSnapshot {
  zoneLabel: string
  onChangeZone: () => void
  onOpenStats: () => void
}

export function ProgressHeader({
  level,
  xpIntoLevel,
  xpForNextLevel,
  progress,
  streak,
  zoneLabel,
  onChangeZone,
  onOpenStats,
}: ProgressHeaderProps) {
  const percent = Math.round(progress * 100)

  return (
    <header className="progress-header">
      <div className="title-row">
        <h1>
          <button type="button" className="zone-switch" onClick={onChangeZone} title="Changer de zone">
            {zoneLabel}
            <span className="zone-switch-icon" aria-hidden="true">
              ▾
            </span>
          </button>
        </h1>
        <div className="title-row-right">
          {streak > 0 && (
            <span className="streak-badge">
              <span className="streak-dot" aria-hidden="true" />
              {streak} jour{streak === 1 ? '' : 's'}
            </span>
          )}
          <button type="button" className="stats-link" onClick={onOpenStats} aria-label="Voir la progression">
            📊
          </button>
        </div>
      </div>
      <div className="level-row">
        <span className="level-label">Niveau {level}</span>
        <div
          className="xp-bar"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression d'expérience"
        >
          <div className="xp-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <span className="xp-label">
          {xpIntoLevel}/{xpForNextLevel} XP
        </span>
      </div>
    </header>
  )
}
