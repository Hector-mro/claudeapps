import { useMemo } from 'react'
import { deriveGamification } from '../gamification'
import type { Todo } from '../types'

export function useGamification(todos: Todo[], nowMs: number = Date.now()) {
  return useMemo(() => deriveGamification(todos, nowMs), [todos, nowMs])
}
