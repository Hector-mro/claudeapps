// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Person, Todo } from '../src/types'
import { planNotifications, summaryPayload, type DueTask, type Plan, type Subscriber } from './notifications'

const PARIS = 'Europe/Paris'

/** `hour:minute` in Paris (UTC+2 in September) on `day` September 2026. */
function paris(hour: number, minute = 0, day = 11): number {
  return Date.UTC(2026, 8, day, hour - 2, minute)
}

function subscriber(person: Person, overrides: Partial<Subscriber> = {}): Subscriber {
  return {
    endpoint: `https://push.example/${person}`,
    p256dh: 'key',
    auth: 'auth',
    person,
    timeZone: PARIS,
    lastSummaryDate: null,
    ...overrides,
  }
}

function task(text: string, dueAt: number, overrides: Partial<Todo> = {}, remindedDueAt: number | null = null): DueTask {
  const todo = { id: text, text, createdAt: 0, difficulty: 'easy', done: false, zone: 'hector', ...overrides, dueAt }
  return { todo: todo as DueTask['todo'], remindedDueAt }
}

/** Titles of the notifications a person's phone receives, in order. */
function titlesFor(plan: Plan, person: Person): string[] {
  return plan.messages.filter((m) => m.subscriber.person === person).map((m) => m.payload.title)
}

const HECTOR = subscriber('hector')
const NINA = subscriber('nina')

describe('reminders', () => {
  const now = paris(13, 30)

  it('reminds each person of their own and the shared tasks due within the hour', () => {
    const plan = planNotifications(
      [HECTOR, NINA],
      [
        task('Loyer', paris(14, 30)),
        task('Poubelles', paris(14, 0), { zone: 'commun' }),
        task('Dentiste', paris(14, 10), { zone: 'nina' }),
        task('Plus tard', paris(14, 31)),
        task('Déjà en retard', paris(13, 0)),
      ],
      now,
    )

    expect(titlesFor(plan, 'hector')).toEqual(['Loyer', 'Poubelles'])
    expect(titlesFor(plan, 'nina')).toEqual(['Poubelles', 'Dentiste'])
    expect(plan.reminded.map((r) => r.id)).toEqual(['Loyer', 'Poubelles', 'Dentiste'])
    expect(plan.messages[0].payload).toMatchObject({ body: 'À 14:30 · Hector', tag: 'Loyer' })
    // Held by the push service at most until the due time.
    expect(plan.messages[0].ttlSeconds).toBe(3600)
  })

  it('sends a reminder once per due date, and again when the date moves', () => {
    const due = paris(14, 0)
    expect(planNotifications([HECTOR], [task('Loyer', due, {}, due)], now).messages).toEqual([])
    expect(titlesFor(planNotifications([HECTOR], [task('Loyer', due, {}, paris(9, 0))], now), 'hector')).toEqual([
      'Loyer',
    ])
  })

  it('records a reminder as handled even when no phone wanted it', () => {
    const plan = planNotifications([], [task('Loyer', paris(14, 0))], now)
    expect(plan.reminded).toEqual([{ id: 'Loyer', dueAt: paris(14, 0) }])
  })
})

describe('morning summary', () => {
  const morning = paris(8, 5)
  const tasks = [
    task('Courses', paris(18, 0)),
    task('Pharmacie', paris(12, 0), { zone: 'commun' }),
    task('Réveil matinal', paris(7, 0)),
    task('Oublié hier', paris(18, 0, 10)),
    task('Demain', paris(9, 0, 12)),
    task('Chez Nina', paris(10, 0), { zone: 'nina' }),
  ]

  it("lists today's tasks still ahead — never the late ones — with a kind word", () => {
    const plan = planNotifications([HECTOR], tasks, morning)

    expect(plan.messages).toHaveLength(1)
    expect(plan.messages[0].payload).toEqual({
      title: 'Bonjour Hector ☀️',
      body: "Au programme aujourd'hui : Pharmacie et Courses.",
      tag: 'summary',
      // The badge still counts everything due by tonight, late ones included.
      badge: 4,
    })
    expect(plan.summarized).toEqual([{ endpoint: HECTOR.endpoint, date: '2026-09-11' }])
  })

  it('is sent once a day', () => {
    const plan = planNotifications([subscriber('hector', { lastSummaryDate: '2026-09-11' })], tasks, morning)
    expect(plan.messages).toEqual([])
    expect(plan.summarized).toEqual([])
  })

  it('only goes out between 8 and 11 in the phone’s time zone', () => {
    expect(planNotifications([HECTOR], tasks, paris(7, 55)).summarized).toEqual([])
    expect(planNotifications([HECTOR], tasks, paris(11, 0)).summarized).toEqual([])
    // 08:05 in Paris is still 07:05 in London.
    expect(planNotifications([subscriber('hector', { timeZone: 'Europe/London' })], tasks, morning).summarized).toEqual(
      [],
    )
  })

  it('stays quiet on a day with nothing planned, but counts the day as done', () => {
    const plan = planNotifications([NINA], [task('Courses', paris(18, 0))], morning)
    expect(plan.messages).toEqual([])
    expect(plan.summarized).toEqual([{ endpoint: NINA.endpoint, date: '2026-09-11' }])
  })
})

describe('summaryPayload', () => {
  const todos = ['Courses', 'Pharmacie', 'Banque', 'Jardin'].map((text) => task(text, paris(18, 0)).todo)

  it('names one task, two tasks, or two and a count', () => {
    expect(summaryPayload('nina', todos.slice(0, 1), 0)?.body).toBe(
      "Une seule chose au programme aujourd'hui : Courses.",
    )
    expect(summaryPayload('nina', todos, 0)?.body).toBe("Au programme aujourd'hui : Courses, Pharmacie et 2 autres.")
    expect(summaryPayload('nina', todos.slice(0, 3), 0)?.body).toBe(
      "Au programme aujourd'hui : Courses, Pharmacie et 1 autre.",
    )
    expect(summaryPayload('nina', [], 0)).toBeNull()
  })
})
