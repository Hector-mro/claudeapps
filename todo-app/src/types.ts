export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Todo {
  id: string
  text: string
  createdAt: number
  dueAt?: number
  difficulty: Difficulty
  done: boolean
  completedAt?: number
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
