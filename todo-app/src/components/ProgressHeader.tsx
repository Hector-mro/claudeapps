import type { GamificationSnapshot } from '../types'

interface ProgressHeaderProps extends GamificationSnapshot {
  onOpenStats: () => void
}

export function ProgressHeader({
  level,
  xpIntoLevel,
  xpForNextLevel,
  progress,
  streak,
  onOpenStats,
}: ProgressHeaderProps) {
  const percent = Math.round(progress * 100)

  return (
    <header className="progress-header">
      <div className="title-row">
        <h1>Tâches</h1>
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
