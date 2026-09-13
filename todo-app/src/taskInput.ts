import { addDays } from './dateUtils'
import type { Difficulty } from './types'

export interface ParsedTaskInput {
  text: string
  difficulty?: Difficulty
  dueAt?: number
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

/** A day given without an hour falls at 8:00. */
const DEFAULT_HOUR = 8

interface Ymd {
  year: number
  /** 1-based, like what a user types. */
  month: number
  day: number
}

/** Whole-segment matches only — never a substring, or « pas trop dur » would become hard. */
const DIFFICULTY_WORDS: Record<string, Difficulty> = {
  facile: 'easy',
  moyen: 'medium',
  moyenne: 'medium',
  difficile: 'hard',
  dur: 'hard',
  dure: 'hard',
}

const RELATIVE_DAYS: Record<string, number> = {
  "aujourd'hui": 0,
  auj: 0,
  ajd: 0,
  demain: 1,
}

/** Days of the week as `Date#getDay` numbers them. */
const WEEKDAYS: Record<string, number> = {
  dimanche: 0,
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
}

/**
 * Accented month names arrive here already stripped (`aout`, `fevrier`, `decembre`).
 * `sept` is both September and the number seven; the two never collide because a month
 * name is only ever read right after a 1-2 digit day number, and a number word only
 * right after « dans ».
 */
const MONTHS: Record<string, number> = {
  janvier: 1,
  janv: 1,
  fevrier: 2,
  fev: 2,
  mars: 3,
  avril: 4,
  avr: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  juil: 7,
  aout: 8,
  septembre: 9,
  sept: 9,
  octobre: 10,
  oct: 10,
  novembre: 11,
  nov: 11,
  decembre: 12,
  dec: 12,
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10,
}

const TIME_WORDS: Record<string, { hour: number; minute: number }> = {
  matin: { hour: 8, minute: 0 },
  midi: { hour: 12, minute: 0 },
  minuit: { hour: 0, minute: 0 },
  soir: { hour: 20, minute: 0 },
}

/** Words carrying no meaning between a day and an hour: « jeudi à 14h », « pour demain ». */
const NOISE = new Set(['le', 'la', 'pour', 'a', 'vers'])

/** « ce soir », « cet après-midi » — only ever valid immediately before a time. */
const TODAY_MARKERS = new Set(['ce', 'cet', 'cette'])

const MINUTE_UNITS = new Set(['min', 'mins', 'minute', 'minutes'])

const CLOCK = /^(\d{1,2})h(\d{1,2})?$/
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/
const DAY_NUMBER = /^(\d{1,2})(?:er)?$/

/**
 * Lower-cases, drops accents, unifies apostrophes, turns a hyphen between letters into a
 * space (`après-demain` ≡ `apres demain`), folds every clock spelling into one token
 * (`8 h 30`, `8:30`, `8 heures 30` → `8h30`), and strips the punctuation and non-breaking
 * spaces a phone keyboard adds (« …, demain ! »).
 */
function normalize(segment: string): string {
  return segment
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/([a-z])-(?=[a-z])/g, '$1 ')
    .replace(/(\d{1,2})\s*(?:h(?:eures?)?|:)(?:\s*(\d{1,2}))?/g, (_match, hour, minute) =>
      minute === undefined ? hour + 'h' : hour + 'h' + minute,
    )
    .replace(/^[.!?;:\s]+|[.!?;:\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function ymdFromMs(ms: number): Ymd {
  const d = new Date(ms)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

/** Shifts by whole calendar days (via `addDays`), so a DST change can't drift the result. */
function dayFromOffset(nowMs: number, days: number): Ymd {
  return ymdFromMs(addDays(nowMs, days))
}

/**
 * Device-local, like every other date in the app. A time falling inside the spring-forward
 * gap silently slides forward, which is fine for a reminder.
 */
function toMs(ymd: Ymd, hour: number, minute: number): number {
  return new Date(ymd.year, ymd.month - 1, ymd.day, hour, minute, 0, 0).getTime()
}

/** Round-trips through `Date` rather than counting days per month: 31/02 and leap years both fall out. */
function isRealDate(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day)
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
}

/** Days until the next occurrence of a weekday, never today (1 to 7). */
function weekdayOffset(target: number, nowMs: number): number {
  const diff = (target - new Date(nowMs).getDay() + 7) % 7
  return diff === 0 ? 7 : diff
}

function numberAt(tokens: string[], index: number): number | null {
  const token = tokens[index]
  if (token === undefined) return null
  if (/^\d{1,3}$/.test(token)) return Number(token)
  const word = NUMBER_WORDS[token]
  return word === undefined ? null : word
}

/**
 * A day/month the user spelled out. A month above 12 is refused rather than read the
 * American way round: leaving « 03/15 » in the task name beats inventing 3 March.
 * Without a year it means the next occurrence, compared by calendar day so a date typed
 * on the day itself stays in the current year.
 */
function resolveAbsolute(day: number, month: number, year: number | undefined, nowMs: number): Ymd | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null

  if (year !== undefined) {
    const full = year < 100 ? 2000 + year : year
    if (full < 2000 || full > 2100) return null
    return isRealDate(full, month, day) ? { year: full, month, day } : null
  }

  const today = ymdFromMs(nowMs)
  for (const candidate of [today.year, today.year + 1]) {
    if (!isRealDate(candidate, month, day)) continue
    const isPast = month < today.month || (month === today.month && day < today.day)
    if (candidate === today.year && isPast) continue
    return { year: candidate, month, day }
  }
  return null
}

/** « le 15 » — the next 15th, rolling into the following month, not the following year. */
function nextDayOfMonth(day: number, nowMs: number): Ymd | null {
  if (day < 1 || day > 31) return null
  const today = ymdFromMs(nowMs)
  let year = today.year
  let month = today.month

  for (let step = 0; step < 13; step++) {
    const reached = year > today.year || month > today.month || day >= today.day
    if (reached && isRealDate(year, month, day)) return { year, month, day }
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return null
}

function skipNoise(tokens: string[], index: number): number {
  let i = index
  while (i < tokens.length && NOISE.has(tokens[i])) i += 1
  return i
}

function isTimeStart(tokens: string[], index: number): boolean {
  const token = tokens[index]
  if (token === undefined) return false
  if (TIME_WORDS[token] !== undefined) return true
  if (token === 'apres' && tokens[index + 1] === 'midi') return true
  return CLOCK.test(token)
}

function tryDay(tokens: string[], index: number, nowMs: number): { ymd: Ymd; next: number } | null {
  const i = skipNoise(tokens, index)
  const token = tokens[i]
  if (token === undefined) return null
  const afterLe = i > index && (tokens[i - 1] === 'le' || tokens[i - 1] === 'la')

  const slash = SLASH_DATE.exec(token)
  if (slash !== null) {
    const year = slash[3] === undefined ? undefined : Number(slash[3])
    const ymd = resolveAbsolute(Number(slash[1]), Number(slash[2]), year, nowMs)
    return ymd === null ? null : { ymd, next: i + 1 }
  }

  const dayNumber = DAY_NUMBER.exec(token)
  if (dayNumber !== null) {
    const month = MONTHS[tokens[i + 1]]
    if (month !== undefined) {
      const yearToken = tokens[i + 2]
      const hasYear = yearToken !== undefined && /^\d{4}$/.test(yearToken)
      const ymd = resolveAbsolute(Number(dayNumber[1]), month, hasYear ? Number(yearToken) : undefined, nowMs)
      return ymd === null ? null : { ymd, next: i + (hasYear ? 3 : 2) }
    }
    // A bare number is a date only right after « le »: on its own it is far too ambiguous
    // to swallow (« peser 1,5 » leaves a segment that is just « 5 »).
    if (afterLe) {
      const ymd = nextDayOfMonth(Number(dayNumber[1]), nowMs)
      return ymd === null ? null : { ymd, next: i + 1 }
    }
    return null
  }

  if (token === 'dans') {
    const count = numberAt(tokens, i + 1)
    if (count === null) return null
    const unit = tokens[i + 2]
    if (unit === 'jour' || unit === 'jours') return { ymd: dayFromOffset(nowMs, count), next: i + 3 }
    if (unit === 'semaine' || unit === 'semaines') return { ymd: dayFromOffset(nowMs, 7 * count), next: i + 3 }
    return null
  }

  // « la semaine prochaine » — the « la » is already gone as noise.
  if (token === 'semaine' && (tokens[i + 1] === 'prochaine' || tokens[i + 1] === 'prochain')) {
    return { ymd: dayFromOffset(nowMs, weekdayOffset(WEEKDAYS.lundi, nowMs)), next: i + 2 }
  }

  const relative = RELATIVE_DAYS[token]
  if (relative !== undefined) return { ymd: dayFromOffset(nowMs, relative), next: i + 1 }

  if (token === 'apres' && tokens[i + 1] === 'demain') return { ymd: dayFromOffset(nowMs, 2), next: i + 2 }

  const weekday = WEEKDAYS[token]
  if (weekday !== undefined) {
    // « prochain » is accepted and means nothing: a weekday is always the next one.
    const after = tokens[i + 1]
    const next = after === 'prochain' || after === 'prochaine' ? i + 2 : i + 1
    return { ymd: dayFromOffset(nowMs, weekdayOffset(weekday, nowMs)), next }
  }

  // « ce soir » pins today instead of the usual today-if-still-ahead-else-tomorrow rule,
  // so it still means tonight when typed at 22h. A lone « ce » must never match, or
  // « acheter du pain, ce » would be eaten.
  if (TODAY_MARKERS.has(token) && isTimeStart(tokens, i + 1)) {
    return { ymd: ymdFromMs(nowMs), next: i + 1 }
  }

  return null
}

function tryTime(tokens: string[], index: number): { hour: number; minute: number; next: number } | null {
  const i = skipNoise(tokens, index)
  const token = tokens[i]
  if (token === undefined) return null

  const clock = CLOCK.exec(token)
  if (clock !== null) {
    const hour = Number(clock[1])
    const minute = clock[2] === undefined ? 0 : Number(clock[2])
    // Out-of-range times are refused outright rather than clamped: « 25h » is not a time.
    if (hour > 23 || minute > 59) return null
    return { hour, minute, next: i + 1 }
  }

  if (token === 'apres' && tokens[i + 1] === 'midi') return { hour: 14, minute: 0, next: i + 2 }

  const word = TIME_WORDS[token]
  if (word !== undefined) return { hour: word.hour, minute: word.minute, next: i + 1 }

  return null
}

/** « dans 2h », « dans 30 min » — a plain offset from now, unlike the day expressions. */
function matchDuration(tokens: string[], nowMs: number): number | null {
  if (tokens[0] !== 'dans') return null

  if (tokens.length === 2) {
    const clock = CLOCK.exec(tokens[1])
    if (clock !== null) {
      const minute = clock[2] === undefined ? 0 : Number(clock[2])
      if (minute > 59) return null
      return nowMs + Number(clock[1]) * HOUR + minute * MINUTE
    }
  }

  if (tokens.length === 3 && MINUTE_UNITS.has(tokens[2])) {
    const count = numberAt(tokens, 1)
    if (count !== null) return nowMs + count * MINUTE
  }

  return null
}

function matchDayTime(tokens: string[], nowMs: number, timeFirst: boolean): number | null {
  let i = 0
  let ymd: Ymd | null = null
  let time: { hour: number; minute: number } | null = null

  if (timeFirst) {
    const matched = tryTime(tokens, i)
    if (matched === null) return null
    time = matched
    i = matched.next
    const day = tryDay(tokens, i, nowMs)
    if (day !== null) {
      ymd = day.ymd
      i = day.next
    }
  } else {
    const day = tryDay(tokens, i, nowMs)
    if (day !== null) {
      ymd = day.ymd
      i = day.next
    }
    const matched = tryTime(tokens, i)
    if (matched !== null) {
      time = matched
      i = matched.next
    }
  }

  // The whole segment has to be accounted for. This one rule is what keeps a task name
  // from being eaten: one word left over and the segment stays in the text.
  if (skipNoise(tokens, i) !== tokens.length) return null

  if (ymd !== null) {
    return time === null ? toMs(ymd, DEFAULT_HOUR, 0) : toMs(ymd, time.hour, time.minute)
  }
  if (time === null) return null

  // An hour with no day: today while it is still ahead, tomorrow once it has passed.
  const today = toMs(ymdFromMs(nowMs), time.hour, time.minute)
  return today > nowMs ? today : toMs(dayFromOffset(nowMs, 1), time.hour, time.minute)
}

/**
 * A whole segment read as a due date, or `null`. The segment must be consumed entirely —
 * « demain matin tôt » has one word too many and so is not a date at all.
 */
function parseDueDate(normalized: string, nowMs: number): number | null {
  if (normalized.length === 0) return null
  const tokens = normalized.split(' ')

  const duration = matchDuration(tokens, nowMs)
  if (duration !== null) return duration

  // Both orders are natural French: « demain 8h » and « 8h demain ».
  return matchDayTime(tokens, nowMs, false) ?? matchDayTime(tokens, nowMs, true)
}

/**
 * Reads the add-task input, where the name may carry a difficulty and a due date as
 * trailing comma-separated segments: « monter l'étagère, moyen, demain ». Both extras are
 * optional and their order is free.
 *
 * Three rules keep an ordinary task name safe:
 *  - only trailing comma-separated segments are candidates, read right to left;
 *  - reading stops at the first segment that doesn't parse, or whose slot is already full;
 *  - a segment counts only if it parses entirely.
 *
 * So « Préparer le dîner de demain » (no comma) and « acheter du pain, du lait » both come
 * through untouched. Pure, with an explicit `nowMs` for deterministic tests, like `dateUtils`.
 */
export function parseTaskInput(raw: string, nowMs: number = Date.now()): ParsedTaskInput {
  const segments = raw.split(',')
  let kept = segments.length
  let difficulty: Difficulty | undefined
  let dueAt: number | undefined

  for (let i = segments.length - 1; i >= 0; i--) {
    const normalized = normalize(segments[i])

    const matchedDifficulty = DIFFICULTY_WORDS[normalized]
    if (matchedDifficulty !== undefined && difficulty === undefined) {
      difficulty = matchedDifficulty
      kept = i
      continue
    }

    const matchedDueAt = parseDueDate(normalized, nowMs)
    if (matchedDueAt !== null && dueAt === undefined) {
      dueAt = matchedDueAt
      kept = i
      continue
    }

    break
  }

  // Nothing left for the name: it was all name after all, so a task really called
  // « demain » stays possible.
  if (kept === 0) return { text: raw.trim() }

  return { text: segments.slice(0, kept).join(',').trim(), difficulty, dueAt }
}
