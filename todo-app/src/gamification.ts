import { addDays, toLocalDateKey } from './dateUtils'
import type { Difficulty, GamificationSnapshot, Todo } from './types'

export const XP_BY_DIFFICULTY: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 35,
}

export function cumulativeXpForLevel(level: number): number {
  return 50 * level * (level - 1)
}

export function levelForXp(xp: number): {
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  progress: number
} {
  let level = 1
  while (xp >= cumulativeXpForLevel(level + 1)) level++

  const base = cumulativeXpForLevel(level)
  const next = cumulativeXpForLevel(level + 1)
  const xpIntoLevel = xp - base
  const xpForNextLevel = next - base

  return { level, xpIntoLevel, xpForNextLevel, progress: xpIntoLevel / xpForNextLevel }
}

export function computeStreak(
  todos: Todo[],
  nowMs: number = Date.now(),
): { streak: number; lastCompletionDate: string | null } {
  const dateKeys = new Set(
    todos
      .filter((t) => t.done && t.completedAt !== undefined)
      .map((t) => toLocalDateKey(t.completedAt as number)),
  )

  if (dateKeys.size === 0) return { streak: 0, lastCompletionDate: null }

  const lastCompletionDate = [...dateKeys].sort().at(-1) ?? null

  const todayKey = toLocalDateKey(nowMs)
  const yesterdayKey = toLocalDateKey(addDays(nowMs, -1))

  let anchorMs: number
  if (dateKeys.has(todayKey)) {
    anchorMs = nowMs
  } else if (dateKeys.has(yesterdayKey)) {
    anchorMs = addDays(nowMs, -1)
  } else {
    return { streak: 0, lastCompletionDate }
  }

  let streak = 0
  let cursor = anchorMs
  while (dateKeys.has(toLocalDateKey(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }

  return { streak, lastCompletionDate }
}

export function deriveGamification(todos: Todo[], nowMs: number = Date.now()): GamificationSnapshot {
  const xp = todos
    .filter((t) => t.done)
    .reduce((sum, t) => sum + XP_BY_DIFFICULTY[t.difficulty], 0)

  const { level, xpIntoLevel, xpForNextLevel, progress } = levelForXp(xp)
  const { streak, lastCompletionDate } = computeStreak(todos, nowMs)

  return { xp, level, xpIntoLevel, xpForNextLevel, progress, streak, lastCompletionDate }
}
