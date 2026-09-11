export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
]

export interface Todo {
  id: string
  text: string
  createdAt: number
  dueAt?: number
  difficulty: Difficulty
  done: boolean
  completedAt?: number
  parentId?: string
}

export interface ArchivedCompletion {
  completedAt: number
  difficulty: Difficulty
}

export interface GamificationSnapshot {
  xp: number
  level: number
  xpIntoLevel: number
  xpForNextLevel: number
  progress: number
  streak: number
  lastCompletionDate: string | null
}

export type Urgency = 'overdue' | 'soon' | 'normal' | 'none'
