import { XP_BY_DIFFICULTY, cumulativeXpForLevel, xpByDay } from '../gamification'
import type { ArchivedCompletion, GamificationSnapshot, Todo } from '../types'

interface StatsPageProps {
  todos: Todo[]
  archivedCompletions: ArchivedCompletion[]
  gamification: GamificationSnapshot
  onBack: () => void
}

const CHART_DAYS = 14

export function StatsPage({ todos, archivedCompletions, gamification, onBack }: StatsPageProps) {
  const daily = xpByDay(todos, CHART_DAYS, Date.now(), archivedCompletions)
  const maxXp = Math.max(1, ...daily.map((d) => d.xp))
  const totalDone = todos.filter((t) => t.done).length
  const nextLevelXp = cumulativeXpForLevel(gamification.level + 1)

  return (
    <div className="stats-page">
      <div className="stats-header">
        <button type="button" className="back-button" onClick={onBack}>
          ← Tâches
        </button>
        <h1>Progression</h1>
      </div>

      <section className="stats-summary">
        <div className="stat-tile">
          <span className="stat-value">{gamification.level}</span>
          <span className="stat-label">Niveau</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{gamification.xp}</span>
          <span className="stat-label">XP total</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{gamification.streak}</span>
          <span className="stat-label">Jours de série</span>
        </div>
        <div className="stat-tile">
          <span className="stat-value">{totalDone}</span>
          <span className="stat-label">Tâches terminées</span>
        </div>
      </section>

      <section className="stats-chart-section">
        <h2>XP des {CHART_DAYS} derniers jours</h2>
        <div
          className="xp-chart"
          role="img"
          aria-label={`Expérience gagnée chaque jour sur les ${CHART_DAYS} derniers jours : ${daily
            .map((d) => `${d.label} ${d.xp} XP`)
            .join(', ')}`}
        >
          {daily.map((d) => (
            <div className="bar-col" key={d.dateKey}>
              <div className="bar-track">
                <div className="bar" style={{ height: `${(d.xp / maxXp) * 100}%` }} />
              </div>
              <span className="bar-label">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-rules">
        <h2>Comment ça marche</h2>
        <ul className="rules-list">
          <li>
            Chaque tâche terminée rapporte de l'XP selon sa difficulté : facile {XP_BY_DIFFICULTY.easy} XP, moyenne{' '}
            {XP_BY_DIFFICULTY.medium} XP, difficile {XP_BY_DIFFICULTY.hard} XP.
          </li>
          <li>
            Chaque niveau demande un peu plus d'XP que le précédent — le niveau {gamification.level + 1} s'atteint à{' '}
            {nextLevelXp} XP.
          </li>
          <li>Décocher une tâche retire l'XP qu'elle avait rapportée : le score reflète toujours les tâches actuellement terminées.</li>
          <li>
            Supprimer une tâche terminée conserve l'XP, le jour de série et le graphique qu'elle avait déjà
            rapportés — seule la tâche disparaît de la liste.
          </li>
          <li>La série de jours grandit tant qu'une tâche est terminée chaque jour ; elle repart à zéro dès qu'un jour est manqué.</li>
          <li>
            Glisser une tâche sur une autre en fait une sous-tâche. La tâche principale se valide automatiquement une
            fois toutes ses sous-tâches terminées.
          </li>
        </ul>
      </section>
    </div>
  )
}
