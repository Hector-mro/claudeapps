// Push notifications: due-date reminders and the morning summary, run by the
// cron trigger (`scheduled` in index.ts, every 5 minutes); "X added a task",
// sent right after the sync that brought it (index.ts); and the phones'
// subscriptions. What to send is decided by pure functions (`planNotifications`,
// `planAdded`); the rest reads D1, sends that plan and records it.
import { countBadge, localDateKey, zonesFor } from '../src/notify'
import { PERSONS, ZONE_LABELS, type Person, type PushSubscribeBody, type Todo, type Zone } from '../src/types'
import { isPerson, isTodo } from '../src/validation'
import { sendPush, type PushTarget, type VapidKeys } from './webpush'

export interface NotifyEnv {
  DB: D1Database
  /** base64url — `wrangler.jsonc` vars; a pair comes from `node scripts/vapid-keys.mjs`. */
  VAPID_PUBLIC_KEY?: string
  /** base64url — `wrangler secret put VAPID_PRIVATE_KEY`. */
  VAPID_PRIVATE_KEY?: string
  /** Contact URL given to push services. */
  VAPID_SUBJECT?: string
}

/** What `public/sw.js` shows. `badge`: the app-icon count (see `countBadge`). */
export interface NotificationPayload {
  title: string
  body: string
  tag: string
  badge?: number
}

export interface Subscriber extends PushTarget {
  person: Person
  timeZone: string
  lastSummaryDate: string | null
}

type DueTodo = Todo & { dueAt: number }

/** A task whose author is known (see `Todo.createdBy`). */
export type AuthoredTodo = Todo & { createdBy: Person }

/** An open task with a due date, and the due date a reminder was already sent for. */
export interface DueTask {
  todo: DueTodo
  remindedDueAt: number | null
}

export interface Message {
  subscriber: Subscriber
  payload: NotificationPayload
  /** How long the push service may hold it for a phone that's offline. */
  ttlSeconds: number
}

export interface Plan {
  messages: Message[]
  /** Reminders now handled, with the due date they were for — including ones no phone wanted. */
  reminded: { id: string; dueAt: number }[]
  /** Phones whose morning summary is handled for that local day: sent, or nothing was due. */
  summarized: { endpoint: string; date: string }[]
}

/** A reminder goes out at the first cron tick less than this long before the due time. */
export const REMINDER_LEAD_MS = 60 * 60_000
/** The morning summary goes out at the first tick in these local hours: never "Bonjour" at 3 pm. */
const SUMMARY_FROM_HOUR = 8
const SUMMARY_UNTIL_HOUR = 11
const SUMMARY_TTL_SECONDS = 3 * 3600
/** Only tasks created this recently count as just added: a device's first sync uploads its whole history. */
export const ADDED_MAX_AGE_MS = 24 * 3600_000
const ADDED_TTL_SECONDS = 24 * 3600
/** A notification is a glance, and a push payload is capped at 4 KB. */
const MAX_TITLE = 80
const SELECT_SUBSCRIPTIONS = 'SELECT endpoint, p256dh, auth, person, time_zone, last_summary_date FROM push_subscriptions'

export function planNotifications(subscribers: Subscriber[], open: DueTask[], nowMs: number): Plan {
  const todos = open.map((task) => task.todo)
  // `dueAt > now`: a task created already late (or late when this shipped) gets no reminder.
  const toRemind = open
    .filter(
      ({ todo, remindedDueAt }) =>
        todo.dueAt > nowMs && todo.dueAt <= nowMs + REMINDER_LEAD_MS && remindedDueAt !== todo.dueAt,
    )
    .map((task) => task.todo)
  const plan: Plan = { messages: [], reminded: toRemind.map(({ id, dueAt }) => ({ id, dueAt })), summarized: [] }

  for (const subscriber of subscribers) {
    const zones = zonesFor(subscriber.person)
    const badge = countBadge(todos, zones, nowMs, subscriber.timeZone)
    for (const todo of toRemind) {
      if (!zones.includes(todo.zone)) continue
      // Past the due time, a reminder is no use: the push service may drop it then.
      const ttlSeconds = (todo.dueAt - nowMs) / 1000
      plan.messages.push({ subscriber, payload: reminderPayload(todo, subscriber.timeZone, badge), ttlSeconds })
    }
    if (isSummaryTime(subscriber, nowMs)) {
      const payload = summaryPayload(subscriber.person, dueLaterToday(todos, zones, nowMs, subscriber.timeZone), badge)
      if (payload) plan.messages.push({ subscriber, payload, ttlSeconds: SUMMARY_TTL_SECONDS })
      plan.summarized.push({ endpoint: subscriber.endpoint, date: localDateKey(nowMs, subscriber.timeZone) })
    }
  }
  return plan
}

function isSummaryTime({ timeZone, lastSummaryDate }: Subscriber, nowMs: number): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(nowMs))
  return hour >= SUMMARY_FROM_HOUR && hour < SUMMARY_UNTIL_HOUR && lastSummaryDate !== localDateKey(nowMs, timeZone)
}

/** Today's tasks still ahead: the summary is the day's plan, never a list of what's late. */
function dueLaterToday(todos: DueTodo[], zones: Zone[], nowMs: number, timeZone: string): DueTodo[] {
  const today = localDateKey(nowMs, timeZone)
  return todos
    .filter((t) => !t.done && zones.includes(t.zone) && t.dueAt >= nowMs && localDateKey(t.dueAt, timeZone) === today)
    .sort((a, b) => a.dueAt - b.dueAt)
}

/**
 * The tasks of a sync that may deserve an "added" notification: open, recent, and with a
 * known author. Tasks added before `createdBy` existed, or on a phone that never said
 * whose it is, have none. Whether the server already knew them is `findAdded`'s job.
 */
export function addedCandidates(upserts: Todo[], nowMs: number): AuthoredTodo[] {
  return upserts.filter(
    (t): t is AuthoredTodo => t.createdBy !== undefined && !t.done && t.createdAt >= nowMs - ADDED_MAX_AGE_MS,
  )
}

/**
 * One notification per phone for the tasks the *other* person just added to its zones —
 * its own zone or Commun. Nobody hears about their own additions.
 */
export function planAdded(subscribers: Subscriber[], added: AuthoredTodo[], todos: Todo[], nowMs: number): Message[] {
  const messages: Message[] = []
  for (const subscriber of subscribers) {
    const zones = zonesFor(subscriber.person)
    const forThem = added.filter((t) => t.createdBy !== subscriber.person && zones.includes(t.zone))
    if (forThem.length === 0) continue
    const badge = countBadge(todos, zones, nowMs, subscriber.timeZone)
    messages.push({
      subscriber,
      payload: addedPayload(forThem, subscriber.timeZone, badge),
      ttlSeconds: ADDED_TTL_SECONDS,
    })
  }
  return messages
}

/** « Nina t'a ajouté une tâche », « Nina a ajouté une tâche à Commun », or a count for several. */
export function addedPayload(tasks: AuthoredTodo[], timeZone: string, badge: number): NotificationPayload {
  // With two people, everything a phone hears about was added by the same one: the other.
  const author = ZONE_LABELS[tasks[0].createdBy]
  const shared = tasks.filter((t) => t.zone === 'commun').length
  const tag = `added-${tasks[0].id}`
  if (tasks.length === 1) {
    const [task] = tasks
    const title = shared ? `${author} a ajouté une tâche à Commun` : `${author} t'a ajouté une tâche`
    const due = task.dueAt === undefined ? '' : ` · ${formatDay(task.dueAt, timeZone)}`
    return { title, body: `${shorten(task.text)}${due}`, tag, badge }
  }
  const count = tasks.length
  let title: string
  if (shared === 0) title = `${author} t'a ajouté ${count} tâches`
  else if (shared === count) title = `${author} a ajouté ${count} tâches à Commun`
  else title = `${author} a ajouté ${count} tâches`
  return { title, body: `${listNames(tasks)}.`, tag, badge }
}

export function reminderPayload(todo: DueTodo, timeZone: string, badge: number): NotificationPayload {
  return {
    title: shorten(todo.text),
    body: `À ${formatTime(todo.dueAt, timeZone)} · ${ZONE_LABELS[todo.zone]}`,
    tag: todo.id,
    badge,
  }
}

export function summaryPayload(person: Person, tasks: Todo[], badge: number): NotificationPayload | null {
  if (tasks.length === 0) return null
  const body =
    tasks.length === 1
      ? `Une seule chose au programme aujourd'hui : ${listNames(tasks)}.`
      : `Au programme aujourd'hui : ${listNames(tasks)}.`
  return { title: `Bonjour ${ZONE_LABELS[person]} ☀️`, body, tag: 'summary', badge }
}

export function welcomePayload(person: Person): NotificationPayload {
  const [own, shared] = zonesFor(person).map((zone) => ZONE_LABELS[zone])
  const other = ZONE_LABELS[PERSONS.find((p) => p !== person) ?? person]
  return {
    title: 'Notifications activées ✓',
    body: `Un rappel 1 h avant chaque échéance, le programme du jour chaque matin, et les tâches que ${other} ajoute — zones ${own} et ${shared}.`,
    tag: 'welcome',
  }
}

/** « A », « A et B », or « A, B et 3 autres ». */
function listNames(tasks: Todo[]): string {
  const [first, second] = tasks.map((t) => shorten(t.text))
  if (tasks.length === 1) return first
  if (tasks.length === 2) return `${first} et ${second}`
  const others = tasks.length - 2
  return `${first}, ${second} et ${others} autre${others > 1 ? 's' : ''}`
}

function formatTime(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone, hour: '2-digit', minute: '2-digit' }).format(ms)
}

/** A due date with its day, e.g. « ven. 12 sept., 14:30 ». */
function formatDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(ms)
}

function shorten(text: string): string {
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1)}…` : text
}

function vapidKeys(env: NotifyEnv): VapidKeys | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null
}

interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
  person: string
  time_zone: string
  last_summary_date: string | null
}

interface TaskRow {
  data: string
  reminded_due_at: number | null
}

function toSubscriber(row: SubscriptionRow): Subscriber[] {
  if (!isPerson(row.person)) return []
  const { endpoint, p256dh, auth, person } = row
  return [{ endpoint, p256dh, auth, person, timeZone: row.time_zone, lastSummaryDate: row.last_summary_date }]
}

function toDueTask(row: TaskRow): DueTask[] {
  const todo: unknown = JSON.parse(row.data)
  if (!isTodo(todo) || todo.dueAt === undefined) return []
  return [{ todo: { ...todo, dueAt: todo.dueAt }, remindedDueAt: row.reminded_due_at }]
}

/** Sends every message; resolves to the subscriptions the push service says are gone (404/410). */
async function sendAll(messages: Message[], vapid: VapidKeys): Promise<string[]> {
  const results = await Promise.all(messages.map((m) => sendPush(m.subscriber, m.payload, vapid, m.ttlSeconds)))
  return [...new Set(messages.filter((_, i) => results[i] === 'gone').map((m) => m.subscriber.endpoint))]
}

function deleteGone(db: D1Database, endpoints: string[]): D1PreparedStatement {
  return db
    .prepare('DELETE FROM push_subscriptions WHERE endpoint IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(endpoints))
}

/** One cron tick. Everything it handled is recorded in one batch, so the next tick doesn't repeat it. */
export async function runNotifications(env: NotifyEnv, nowMs: number): Promise<void> {
  const vapid = vapidKeys(env)
  if (!vapid) {
    console.warn('notifications skipped: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY or VAPID_SUBJECT is missing')
    return
  }

  const [subscriptions, tasks] = await env.DB.batch([
    env.DB.prepare(SELECT_SUBSCRIPTIONS),
    // Every open task with a due date — a household's worth — feeds reminders, summaries and badges.
    env.DB.prepare('SELECT data, reminded_due_at FROM todos WHERE deleted = 0 AND done = 0 AND due_at IS NOT NULL'),
  ])
  const plan = planNotifications(
    (subscriptions.results as SubscriptionRow[]).flatMap(toSubscriber),
    (tasks.results as TaskRow[]).flatMap(toDueTask),
    nowMs,
  )
  const gone = await sendAll(plan.messages, vapid)

  // Recorded even when a push failed: better one missed reminder than one repeated every 5 minutes.
  const writes: D1PreparedStatement[] = []
  if (plan.reminded.length > 0) {
    writes.push(
      env.DB.prepare(
        `UPDATE todos SET reminded_due_at = r.due_at
         FROM (SELECT json_extract(value, '$.id') AS id, json_extract(value, '$.dueAt') AS due_at FROM json_each(?1)) AS r
         WHERE todos.id = r.id`,
      ).bind(JSON.stringify(plan.reminded)),
    )
  }
  if (plan.summarized.length > 0) {
    writes.push(
      env.DB.prepare(
        `UPDATE push_subscriptions SET last_summary_date = s.date
         FROM (SELECT json_extract(value, '$.endpoint') AS endpoint, json_extract(value, '$.date') AS date
               FROM json_each(?1)) AS s
         WHERE push_subscriptions.endpoint = s.endpoint`,
      ).bind(JSON.stringify(plan.summarized)),
    )
  }
  if (gone.length > 0) writes.push(deleteGone(env.DB, gone))
  if (writes.length > 0) await env.DB.batch(writes)
}

/** Of `candidates`, the tasks the server didn't know yet. Call it before applying the sync. */
export async function findAdded(db: D1Database, candidates: AuthoredTodo[]): Promise<AuthoredTodo[]> {
  if (candidates.length === 0) return []
  // Tombstones count as known: a deleted task sent again by a stale phone isn't news.
  const { results } = await db
    .prepare('SELECT id FROM todos WHERE id IN (SELECT value FROM json_each(?1))')
    .bind(JSON.stringify(candidates.map((t) => t.id)))
    .all<{ id: string }>()
  const known = new Set(results.map((row) => row.id))
  return candidates.filter((t) => !known.has(t.id))
}

/** The "X added a task" notifications for one sync; runs after the sync has answered (`ctx.waitUntil`). */
export async function notifyAdded(env: NotifyEnv, added: AuthoredTodo[], todos: Todo[], nowMs: number): Promise<void> {
  const vapid = vapidKeys(env)
  if (!vapid || added.length === 0) return
  const { results } = await env.DB.prepare(SELECT_SUBSCRIPTIONS).all<SubscriptionRow>()
  const gone = await sendAll(planAdded(results.flatMap(toSubscriber), added, todos, nowMs), vapid)
  if (gone.length > 0) await deleteGone(env.DB, gone).run()
}

/** Insert or refresh a phone's subscription; its summary bookkeeping survives a refresh. */
export async function saveSubscription(db: D1Database, body: PushSubscribeBody, nowMs: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, person, time_zone, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (endpoint) DO UPDATE SET
         p256dh = excluded.p256dh, auth = excluded.auth, person = excluded.person, time_zone = excluded.time_zone`,
    )
    .bind(body.endpoint, body.keys.p256dh, body.keys.auth, body.person, body.timeZone, nowMs)
    .run()
}

export async function deleteSubscription(db: D1Database, endpoint: string): Promise<void> {
  await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(endpoint).run()
}

/** Sent when a phone turns notifications on: a confirmation that doubles as an end-to-end check. */
export async function sendWelcome(env: NotifyEnv, body: PushSubscribeBody): Promise<void> {
  const vapid = vapidKeys(env)
  if (!vapid) return
  await sendPush({ endpoint: body.endpoint, ...body.keys }, welcomePayload(body.person), vapid, 300)
}
