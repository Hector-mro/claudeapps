import type { Todo, Urgency } from './types'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const WEEKDAYS_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

function startOfDay(ms: number): Date {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d
}

export function toLocalDateKey(ms: number): string {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function calendarDayDiff(targetMs: number, nowMs: number): number {
  const diffMs = startOfDay(targetMs).getTime() - startOfDay(nowMs).getTime()
  return Math.round(diffMs / DAY)
}

export function addDays(ms: number, days: number): number {
  const d = new Date(ms)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function formatRelativeTimeAgo(fromMs: number, nowMs: number = Date.now()): string {
  const diff = nowMs - fromMs
  if (diff < MINUTE) return "à l'instant"
  if (diff < HOUR) return `il y a ${Math.floor(diff / MINUTE)}min`
  if (diff < DAY) return `il y a ${Math.floor(diff / HOUR)}h`
  if (diff < 7 * DAY) return `il y a ${Math.floor(diff / DAY)}j`
  return new Date(fromMs).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export function formatDueLabel(dueAtMs: number, nowMs: number = Date.now()): string {
  const dayDiff = calendarDayDiff(dueAtMs, nowMs)
  const time = formatTime(dueAtMs)

  if (dayDiff === 0) return `aujourd'hui ${time}`
  if (dayDiff === 1) return `demain ${time}`
  if (dayDiff === -1) return `hier ${time}`
  if (dayDiff <= -2) {
    const n = Math.abs(dayDiff)
    return `en retard de ${n} jour${n > 1 ? 's' : ''}`
  }
  if (dayDiff >= 2 && dayDiff <= 6) return `${WEEKDAYS_FR[new Date(dueAtMs).getDay()]} ${time}`
  return new Date(dueAtMs).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })
}

export function getUrgency(todo: Todo, nowMs: number = Date.now()): Urgency {
  if (!todo.dueAt) return 'none'
  if (todo.dueAt < nowMs) return 'overdue'
  if (todo.dueAt - nowMs <= DAY) return 'soon'
  return 'normal'
}
