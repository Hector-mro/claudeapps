import { useMemo } from 'react'
import { deriveGamification } from '../gamification'
import type { ArchivedCompletion, Todo } from '../types'

export function useGamification(
  todos: Todo[],
  archived: ArchivedCompletion[] = [],
  nowMs: number = Date.now(),
) {
  return useMemo(() => deriveGamification(todos, nowMs, archived), [todos, archived, nowMs])
}
