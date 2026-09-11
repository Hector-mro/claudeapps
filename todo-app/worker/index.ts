// Sync API for todo-app. The app itself stays on GitHub Pages and calls this
// Worker cross-origin; the data lives in D1 (`migrations/`). One shared access
// code (the `ACCESS_KEY` secret), no accounts. Sync model: `src/sync/diff.ts`.
// Also sends the push notifications (`notifications.ts`), from a cron trigger.
import type { SyncChanges, SyncSnapshot } from '../src/types'
import { parseChanges, parsePushSubscribeBody } from '../src/validation'
import { deleteSubscription, runNotifications, saveSubscription, sendWelcome, type NotifyEnv } from './notifications'

interface Env extends NotifyEnv {
  /** The shared access code — `wrangler secret put ACCESS_KEY`. */
  ACCESS_KEY: string
  /** Comma-separated origins allowed to call the API: the Pages site (localhost in `.dev.vars`). */
  ALLOWED_ORIGIN: string
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env)
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { ...cors, 'cache-control': 'no-store' } })

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    const { pathname } = new URL(request.url)
    if (pathname === '/api/health') return json({ ok: true })

    // A wrong code gets the same 404 as an unknown route: no hint that anything is here.
    if (!(await isAuthorized(request, env))) return json({ error: 'not_found' }, 404)

    if (pathname === '/api/state' && request.method === 'GET') return json(await readState(env.DB))

    if (pathname === '/api/sync' && request.method === 'POST') {
      const changes = parseChanges(await request.json().catch(() => null))
      if (!changes) return json({ error: 'bad_request' }, 400)
      await applyChanges(env.DB, changes)
      return json(await readState(env.DB))
    }

    if (pathname === '/api/push/subscribe' && request.method === 'POST') {
      const body = parsePushSubscribeBody(await request.json().catch(() => null))
      if (!body) return json({ error: 'bad_request' }, 400)
      await saveSubscription(env.DB, body, Date.now())
      if (body.welcome) await sendWelcome(env, body)
      return json({ ok: true })
    }

    if (pathname === '/api/push/unsubscribe' && request.method === 'POST') {
      const body: unknown = await request.json().catch(() => null)
      const endpoint = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).endpoint : null
      if (typeof endpoint !== 'string') return json({ error: 'bad_request' }, 400)
      await deleteSubscription(env.DB, endpoint)
      return json({ ok: true })
    }

    return json({ error: 'not_found' }, 404)
  },

  scheduled(controller, env, ctx) {
    ctx.waitUntil(runNotifications(env, controller.scheduledTime))
  },
} satisfies ExportedHandler<Env>

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin')
  const allowed = env.ALLOWED_ORIGIN.split(',').map((o) => o.trim())
  if (!origin || !allowed.includes(origin)) return { vary: 'Origin' }
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get('authorization') ?? ''
  const given = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : ''
  if (!given || !env.ACCESS_KEY) return false
  // Hash both sides first: timingSafeEqual needs equal lengths, and the real length mustn't leak.
  const [a, b] = await Promise.all([sha256(given), sha256(env.ACCESS_KEY)])
  return crypto.subtle.timingSafeEqual(a, b)
}

function sha256(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
}

async function readState(db: D1Database): Promise<SyncSnapshot> {
  const [todos, archived] = await db.batch<{ data: string }>([
    db.prepare('SELECT data FROM todos WHERE deleted = 0 ORDER BY rowid'),
    db.prepare('SELECT data FROM archived_completions ORDER BY rowid'),
  ])
  return {
    todos: todos.results.map((row) => JSON.parse(row.data)),
    archived: archived.results.map((row) => JSON.parse(row.data)),
  }
}

/**
 * One statement per kind of change whatever the number of items (via `json_each`):
 * a first sync uploads a device's whole history, and D1 caps queries per request.
 * The batch runs as a single transaction.
 */
async function applyChanges(db: D1Database, { upserts, deletes, archived }: SyncChanges): Promise<void> {
  const now = Date.now()
  await db.batch([
    // `WHERE todos.deleted = 0`: a deleted task stays deleted, even if an offline
    // device later sends an edit it made before learning about the deletion.
    db
      .prepare(
        `INSERT INTO todos (id, zone, due_at, done, data, updated_at)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.zone'), json_extract(value, '$.dueAt'),
                json_extract(value, '$.done'), value, ?2
         FROM json_each(?1) WHERE true
         ON CONFLICT (id) DO UPDATE SET
           zone = excluded.zone, due_at = excluded.due_at, done = excluded.done,
           data = excluded.data, updated_at = excluded.updated_at
         WHERE todos.deleted = 0`,
      )
      .bind(JSON.stringify(upserts), now),
    db
      .prepare('UPDATE todos SET deleted = 1, updated_at = ?2 WHERE id IN (SELECT value FROM json_each(?1))')
      .bind(JSON.stringify(deletes), now),
    db
      .prepare(
        `INSERT OR IGNORE INTO archived_completions (id, zone, data)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.zone'), value FROM json_each(?1)`,
      )
      .bind(JSON.stringify(archived)),
  ])
}
