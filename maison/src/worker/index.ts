import { Hono } from 'hono';
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

// Enregistré avant le middleware de jeton : dans Hono l'ordre de
// déclaration est l'ordre d'exécution, et `/api/:token/*` capturerait
// `/api/health` en lisant « health » comme un jeton.
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
  await next();
});

app.get('/api/:token/today', async (c) => {
  const household = c.get('household');
  const payload = await buildToday(c.env.DB, household.weekly_review_weekday);
  // Le mur repasse toutes les 60 s : rien ne doit être servi depuis un cache.
  c.header('Cache-Control', 'no-store');
  return c.json(payload);
});

app.notFound((c) => c.json({ error: 'not_found' }, 404));

export default app;
