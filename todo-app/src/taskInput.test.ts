import { describe, expect, it } from 'vitest'
import { parseTaskInput } from './taskInput'

/** Thursday 15 January 2026, midday. */
const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime()
/** Same day, 22:00 — for the rules that depend on the hour already being late. */
const LATE = new Date(2026, 0, 15, 22, 0, 0).getTime()

function at(year: number, month: number, day: number, hour = 8, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime()
}

/** The due date of `raw`, or `null` when nothing was recognised. */
function due(raw: string, nowMs: number = NOW): number | null {
  return parseTaskInput(raw, nowMs).dueAt ?? null
}

describe('parseTaskInput', () => {
  it('reads a name, a difficulty and a date in one line', () => {
    expect(parseTaskInput("monter l'étagère, moyen, demain", NOW)).toEqual({
      text: "monter l'étagère",
      difficulty: 'medium',
      dueAt: at(2026, 1, 16),
    })
  })

  it('does not care in which order the two extras come', () => {
    expect(parseTaskInput("monter l'étagère, demain, moyen", NOW)).toEqual(
      parseTaskInput("monter l'étagère, moyen, demain", NOW),
    )
  })

  it('takes either extra on its own', () => {
    expect(parseTaskInput('ranger le garage, facile', NOW)).toEqual({
      text: 'ranger le garage',
      difficulty: 'easy',
      dueAt: undefined,
    })
    expect(parseTaskInput('ranger le garage, demain', NOW)).toEqual({
      text: 'ranger le garage',
      difficulty: undefined,
      dueAt: at(2026, 1, 16),
    })
  })
})

describe('parseTaskInput / difficulty', () => {
  it('accepts every spelling the app itself uses', () => {
    expect(parseTaskInput('x, facile', NOW).difficulty).toBe('easy')
    expect(parseTaskInput('x, moyen', NOW).difficulty).toBe('medium')
    expect(parseTaskInput('x, moyenne', NOW).difficulty).toBe('medium')
    expect(parseTaskInput('x, difficile', NOW).difficulty).toBe('hard')
    expect(parseTaskInput('x, dur', NOW).difficulty).toBe('hard')
    expect(parseTaskInput('x, dure', NOW).difficulty).toBe('hard')
  })

  it('ignores case', () => {
    expect(parseTaskInput('x, Facile', NOW).difficulty).toBe('easy')
    expect(parseTaskInput('x, MOYENNE', NOW).difficulty).toBe('medium')
  })

  it('needs the whole segment, never a word inside one', () => {
    expect(parseTaskInput('choisir un fromage, pas trop dur', NOW)).toEqual({
      text: 'choisir un fromage, pas trop dur',
      difficulty: undefined,
      dueAt: undefined,
    })
  })

  it('stops at a second difficulty instead of overwriting the first', () => {
    expect(parseTaskInput('x, facile, difficile', NOW)).toEqual({
      text: 'x, facile',
      difficulty: 'hard',
      dueAt: undefined,
    })
  })
})

describe('parseTaskInput / relative days', () => {
  it('handles today, tomorrow and the day after', () => {
    expect(due("x, aujourd'hui")).toBe(at(2026, 1, 15))
    expect(due('x, auj')).toBe(at(2026, 1, 15))
    expect(due('x, ajd')).toBe(at(2026, 1, 15))
    expect(due('x, demain')).toBe(at(2026, 1, 16))
    expect(due('x, après-demain')).toBe(at(2026, 1, 17))
    expect(due('x, apres demain')).toBe(at(2026, 1, 17))
  })

  it('is not bothered by accents or case', () => {
    expect(due('x, APRÈS-DEMAIN')).toBe(at(2026, 1, 17))
    expect(due('x, Demain')).toBe(at(2026, 1, 16))
  })

  it('reads a weekday as the next strictly future one', () => {
    // NOW is a Thursday.
    expect(due('x, vendredi')).toBe(at(2026, 1, 16))
    expect(due('x, lundi')).toBe(at(2026, 1, 19))
    expect(due('x, mercredi')).toBe(at(2026, 1, 21))
    expect(due('x, jeudi')).toBe(at(2026, 1, 22))
  })

  it('treats « prochain » as meaning nothing at all', () => {
    expect(due('x, lundi prochain')).toBe(due('x, lundi'))
    expect(due('x, jeudi prochain')).toBe(at(2026, 1, 22))
  })

  it('keeps the next-weekday rule even with an hour attached', () => {
    expect(due('x, jeudi 18h')).toBe(at(2026, 1, 22, 18, 0))
  })

  it('counts days and weeks ahead, in digits or in words', () => {
    expect(due('x, dans 3 jours')).toBe(at(2026, 1, 18))
    expect(due('x, dans trois jours')).toBe(at(2026, 1, 18))
    expect(due('x, dans 1 jour')).toBe(at(2026, 1, 16))
    expect(due('x, dans une semaine')).toBe(at(2026, 1, 22))
    expect(due('x, dans 2 semaines')).toBe(at(2026, 1, 29))
  })

  it('reads « la semaine prochaine » as next Monday', () => {
    expect(due('x, la semaine prochaine')).toBe(at(2026, 1, 19))
    expect(due('x, semaine prochaine')).toBe(at(2026, 1, 19))
  })
})

describe('parseTaskInput / hours', () => {
  it('defaults to 8:00 when only a day is given', () => {
    expect(due('x, demain')).toBe(at(2026, 1, 16, 8, 0))
  })

  it('reads every clock spelling', () => {
    expect(due('x, demain 8h')).toBe(at(2026, 1, 16, 8, 0))
    expect(due('x, demain 8h30')).toBe(at(2026, 1, 16, 8, 30))
    expect(due('x, demain 8h05')).toBe(at(2026, 1, 16, 8, 5))
    expect(due('x, demain 8:30')).toBe(at(2026, 1, 16, 8, 30))
    expect(due('x, demain 8 h 30')).toBe(at(2026, 1, 16, 8, 30))
    expect(due('x, demain 20h00')).toBe(at(2026, 1, 16, 20, 0))
    expect(due('x, vendredi 18h30')).toBe(at(2026, 1, 16, 18, 30))
  })

  it('reads the named moments of the day', () => {
    expect(due('x, demain matin')).toBe(at(2026, 1, 16, 8, 0))
    expect(due('x, demain midi')).toBe(at(2026, 1, 16, 12, 0))
    expect(due('x, demain après-midi')).toBe(at(2026, 1, 16, 14, 0))
    expect(due('x, demain soir')).toBe(at(2026, 1, 16, 20, 0))
    expect(due('x, demain minuit')).toBe(at(2026, 1, 16, 0, 0))
    expect(due('x, après-demain matin')).toBe(at(2026, 1, 17, 8, 0))
  })

  it('puts an hour on its own today while it is ahead, tomorrow once it has passed', () => {
    expect(due('x, soir')).toBe(at(2026, 1, 15, 20, 0))
    expect(due('x, 18h')).toBe(at(2026, 1, 15, 18, 0))
    expect(due('x, 8h')).toBe(at(2026, 1, 16, 8, 0))
    // NOW is exactly midday, and the rule is strictly ahead.
    expect(due('x, midi')).toBe(at(2026, 1, 16, 12, 0))
    expect(due('x, 18h', LATE)).toBe(at(2026, 1, 16, 18, 0))
  })

  it('lets « ce soir » stay tonight even when typed late', () => {
    expect(due('x, ce soir', LATE)).toBe(at(2026, 1, 15, 20, 0))
    expect(due('x, cet après-midi')).toBe(at(2026, 1, 15, 14, 0))
    expect(due('x, ce soir')).toBe(at(2026, 1, 15, 20, 0))
  })

  it('accepts the hour before the day', () => {
    expect(due('x, 8h demain')).toBe(at(2026, 1, 16, 8, 0))
    expect(due('x, 18h jeudi')).toBe(at(2026, 1, 22, 18, 0))
  })

  it('ignores the little words around an hour', () => {
    expect(due('x, à 20h')).toBe(at(2026, 1, 15, 20, 0))
    expect(due('x, vers 20h')).toBe(at(2026, 1, 15, 20, 0))
    expect(due('x, jeudi à 14h')).toBe(at(2026, 1, 22, 14, 0))
    expect(due('x, pour demain')).toBe(at(2026, 1, 16))
    expect(due('x, demain !')).toBe(at(2026, 1, 16))
  })

  it('counts a duration forward from now', () => {
    expect(due('x, dans 2h')).toBe(new Date(2026, 0, 15, 14, 0, 0).getTime())
    expect(due('x, dans 2 heures')).toBe(new Date(2026, 0, 15, 14, 0, 0).getTime())
    expect(due('x, dans 1h30')).toBe(new Date(2026, 0, 15, 13, 30, 0).getTime())
    expect(due('x, dans 30 min')).toBe(new Date(2026, 0, 15, 12, 30, 0).getTime())
  })

  it('refuses an impossible time rather than clamping it', () => {
    expect(due('x, 25h')).toBeNull()
    expect(due('x, 8h75')).toBeNull()
  })
})

describe('parseTaskInput / spelled-out dates', () => {
  it('reads day/month, with or without a year', () => {
    expect(due('x, 15/03')).toBe(at(2026, 3, 15))
    expect(due('x, 15/3')).toBe(at(2026, 3, 15))
    expect(due('x, 15/3/26')).toBe(at(2026, 3, 15))
    expect(due('x, 15/03/2026')).toBe(at(2026, 3, 15))
    expect(due('x, 15/03 18h')).toBe(at(2026, 3, 15, 18, 0))
  })

  it('reads a month by name', () => {
    expect(due('x, 15 mars')).toBe(at(2026, 3, 15))
    expect(due('x, 1er mars')).toBe(at(2026, 3, 1))
    expect(due('x, 15 août')).toBe(at(2026, 8, 15))
    expect(due('x, 15 mars 2027')).toBe(at(2027, 3, 15))
    expect(due('x, le 15 mars')).toBe(at(2026, 3, 15))
  })

  it('picks the next occurrence, comparing calendar days not instants', () => {
    // Today's own date must stay in the current year even though 8:00 is behind us.
    expect(due('x, 15/01')).toBe(at(2026, 1, 15))
    expect(due('x, 14/01')).toBe(at(2027, 1, 14))
  })

  it('reads « le 15 » as the next 15th of a month', () => {
    expect(due('x, le 15')).toBe(at(2026, 1, 15))
    expect(due('x, le 14')).toBe(at(2026, 2, 14))
    expect(due('x, le 20 à 18h')).toBe(at(2026, 1, 20, 18, 0))
  })

  it('refuses a date that does not exist, and never swaps day and month', () => {
    expect(due('x, 31/02')).toBeNull()
    expect(due('x, 30/02')).toBeNull()
    expect(due('x, 03/15')).toBeNull()
    expect(due('x, 00/03')).toBeNull()
  })
})

describe('parseTaskInput / leaving ordinary names alone', () => {
  it('never touches a name without a comma', () => {
    expect(parseTaskInput('Préparer le dîner de demain', NOW)).toEqual({
      text: 'Préparer le dîner de demain',
      difficulty: undefined,
      dueAt: undefined,
    })
  })

  it('keeps a comma that is part of the name', () => {
    expect(parseTaskInput('acheter du pain, du lait', NOW)).toEqual({
      text: 'acheter du pain, du lait',
      difficulty: undefined,
      dueAt: undefined,
    })
  })

  it('still reads the last segment past a comma it did not understand', () => {
    expect(parseTaskInput('courses, du lait, demain', NOW)).toEqual({
      text: 'courses, du lait',
      difficulty: undefined,
      dueAt: at(2026, 1, 16),
    })
  })

  it('refuses a segment with one word too many', () => {
    expect(parseTaskInput('courses, demain matin tôt', NOW)).toEqual({
      text: 'courses, demain matin tôt',
      difficulty: undefined,
      dueAt: undefined,
    })
  })

  it('leaves a decimal comma alone', () => {
    expect(parseTaskInput('acheter 1,5 kg de farine', NOW).text).toBe('acheter 1,5 kg de farine')
    expect(parseTaskInput('peser 1,5', NOW)).toEqual({
      text: 'peser 1,5',
      difficulty: undefined,
      dueAt: undefined,
    })
  })

  it('refuses a bare number as an hour', () => {
    expect(parseTaskInput('x, demain 8', NOW)).toEqual({
      text: 'x, demain 8',
      difficulty: undefined,
      dueAt: undefined,
    })
  })

  it('refuses a lone filler word', () => {
    expect(parseTaskInput('acheter du pain, ce', NOW).text).toBe('acheter du pain, ce')
    expect(parseTaskInput('acheter du pain, pour', NOW).text).toBe('acheter du pain, pour')
    expect(parseTaskInput('acheter du pain, à', NOW).text).toBe('acheter du pain, à')
    expect(parseTaskInput('acheter du pain, le', NOW).text).toBe('acheter du pain, le')
  })

  it('keeps the whole thing when there would be no name left', () => {
    expect(parseTaskInput('demain', NOW)).toEqual({ text: 'demain' })
    expect(parseTaskInput('facile', NOW)).toEqual({ text: 'facile' })
    expect(parseTaskInput('demain, moyen', NOW)).toEqual({ text: 'demain, moyen' })
  })

  it('handles an empty input', () => {
    expect(parseTaskInput('', NOW).text).toBe('')
    expect(parseTaskInput('   ', NOW).text).toBe('')
  })
})
