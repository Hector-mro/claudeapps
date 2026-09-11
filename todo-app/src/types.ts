export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
]

export type Zone = 'hector' | 'nina' | 'commun'

/** Zones in menu order. */
export const ZONES: Zone[] = ['hector', 'nina', 'commun']

export const ZONE_LABELS: Record<Zone, string> = {
  hector: 'Hector',
  nina: 'Nina',
  commun: 'Commun',
}

export interface Todo {
  id: string
  text: string
  createdAt: number
  dueAt?: number
  difficulty: Difficulty
  done: boolean
  completedAt?: number
  parentId?: string
  zone: Zone
}

export interface ArchivedCompletion {
  id: string
  completedAt: number
  difficulty: Difficulty
  zone: Zone
}

/** Everything that is synced — a device's state, or the server's. */
export interface SyncSnapshot {
  todos: Todo[]
  archived: ArchivedCompletion[]
}

/** What a device changed since the server's last confirmed state; the body of `POST /api/sync`. */
export interface SyncChanges {
  upserts: Todo[]
  deletes: string[]
  archived: ArchivedCompletion[]
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
