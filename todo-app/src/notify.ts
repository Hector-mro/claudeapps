import type { Person, Todo, Zone } from './types'

// Notification rules shared by the app (the icon badge) and the worker (push
// notifications, `worker/notifications.ts`) — so this file must stay DOM-free.

/** The zones a person's phone hears about: their own, plus the shared one. */
export function zonesFor(person: Person): Zone[] {
  return [person, 'commun']
}

/** `YYYY-MM-DD` of the calendar day `ms` falls on in `timeZone`. Keys compare as strings. */
export function localDateKey(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(ms)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

/**
 * The app-icon badge: open tasks in `zones` due today or earlier. Not only overdue
 * ones — iOS lets the badge change only while the app is open or when a notification
 * arrives, so it has to be a count that doesn't go stale during the day.
 */
export function countBadge(todos: Todo[], zones: Zone[], nowMs: number, timeZone: string): number {
  const today = localDateKey(nowMs, timeZone)
  return todos.filter(
    (t) => !t.done && t.dueAt !== undefined && zones.includes(t.zone) && localDateKey(t.dueAt, timeZone) <= today,
  ).length
}
