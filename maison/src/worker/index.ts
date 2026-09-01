import { Hono } from 'hono';
import { addOneoff, completeTask, skipTask, undoCompletion } from './actions';
import { buildReview, deactivateTask, reassignDomain } from './review';
import { buildToday } from './today';

interface Bindings {
  DB: D1Database;
}

interface Household {
  id: number;
  weekly_review_weekday: number;
}

interface Variables {
  household: Household;
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Enregistré avant le middleware de jeton : dans Hono l'ordre de déclaration
// est l'ordre d'exécution, et `/api/:token/*` capturerait `/api/health` en
// lisant « health » comme un jeton.
app.get('/api/health', (c) => c.json({ ok: true }));

/**
 * Pas de comptes : l'accès tient au jeton du foyer, présent dans l'URL.
 * Un jeton inconnu renvoie 404 et non 403 — inutile de confirmer à qui
 * tombe dessus qu'il existe quelque chose derrière cette adresse.
 */
app.use('/api/:token/*', async (c, next) => {
  const token = c.req.param('token');
  const household = await c.env.DB.prepare(
    'SELECT id, weekly_review_weekday FROM household WHERE display_token = ?1',
  )
    .bind(token)
    .first<Household>();

  if (!household) return c.json({ error: 'not_found' }, 404);

  c.set('household', household);
  // Rien de ce qui passe par le jeton ne doit être mis en cache.
  c.header('Cache-Control', 'no-store');
  await next();
});

app.get('/api/:token/today', async (c) => {
  const household = c.get('household');
  return c.json(await buildToday(c.env.DB, household.weekly_review_weekday));
});

app.get('/api/:token/domains', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.name, d.minimum_standard,
            p.id AS owner_id, p.name AS owner_name, p.color AS owner_color
     FROM domains d JOIN people p ON p.id = d.owner_id
     WHERE d.active = 1 ORDER BY d.name COLLATE NOCASE`,
  ).all();
  return c.json({ domains: results });
});

app.get('/api/:token/review', async (c) => {
  const household = c.get('household');
  return c.json(await buildReview(c.env.DB, household.weekly_review_weekday));
});

/** Codes HTTP des erreurs métier : tout le reste est un 400. */
const STATUS: Record<string, 400 | 404 | 409> = {
  task_not_found: 404,
  person_not_found: 404,
  domain_not_found: 404,
  completion_not_found: 404,
  undo_expired: 409,
  undo_unavailable: 409,
  empty_title: 400,
};

function isError(value: object): value is { error: string } {
  return 'error' in value;
}

async function readBody(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asId(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

app.post('/api/:token/tasks/:id/complete', async (c) => {
  const taskId = asId(c.req.param('id'));
  const personId = asId((await readBody(c)).person_id);
  if (taskId === null || personId === null) return c.json({ error: 'bad_request' }, 400);

  const result = await completeTask(c.env.DB, taskId, personId);
  return isError(result) ? c.json(result, STATUS[result.error] ?? 400) : c.json(result);
});

app.post('/api/:token/tasks/:id/skip', async (c) => {
  const taskId = asId(c.req.param('id'));
  const personId = asId((await readBody(c)).person_id);
  if (taskId === null || personId === null) return c.json({ error: 'bad_request' }, 400);

  const result = await skipTask(c.env.DB, taskId, personId);
  return isError(result) ? c.json(result, STATUS[result.error] ?? 400) : c.json(result);
});

app.delete('/api/:token/completions/:id', async (c) => {
  const completionId = asId(c.req.param('id'));
  if (completionId === null) return c.json({ error: 'bad_request' }, 400);

  const result = await undoCompletion(c.env.DB, completionId);
  return isError(result) ? c.json(result, STATUS[result.error] ?? 400) : c.json(result);
});

app.post('/api/:token/tasks', async (c) => {
  const body = await readBody(c);
  const domainId = asId(body.domain_id);
  const title = typeof body.title === 'string' ? body.title : '';
  if (domainId === null) return c.json({ error: 'bad_request' }, 400);

  const result = await addOneoff(c.env.DB, title, domainId);
  return isError(result) ? c.json(result, STATUS[result.error] ?? 400) : c.json(result, 201);
});

app.post('/api/:token/domains/:id/owner', async (c) => {
  const domainId = asId(c.req.param('id'));
  const ownerId = asId((await readBody(c)).owner_id);
  if (domainId === null || ownerId === null) return c.json({ error: 'bad_request' }, 400);

  const result = await reassignDomain(c.env.DB, domainId, ownerId);
  return isError(result) ? c.json(result, STATUS[result.error] ?? 400) : c.json(result);
});

// Désactivation, pas suppression : l'historique des semaines passées reste lisible.
app.delete('/api/:token/tasks/:id', async (c) => {
  const taskId = asId(c.req.param('id'));
  if (taskId === null) return c.json({ error: 'bad_request' }, 400);

  const result = await deactivateTask(c.env.DB, taskId);
  return isError(result) ? c.json(result, STATUS[result.error] ?? 400) : c.json(result);
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
