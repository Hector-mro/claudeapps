import type { DomainView, ResistingTask, ReviewPerson, ReviewResponse } from '../shared/types';
import { addDays, startOfDayUTC, todayISO, weekdayIndex } from './dates';

/** Fenêtre de la revue. */
const WINDOW_DAYS = 7;

/**
 * À partir de deux reports consécutifs, une tâche apparaît dans « Ça résiste ».
 * À trois, la revue propose de la retirer : si elle n'est jamais faite, elle
 * n'a pas sa place dans le système — elle ne fait qu'occuper de la place et
 * produire de la culpabilité.
 *
 * Les reports sont comptés **depuis la dernière réalisation** et non depuis
 * toujours : trois reports étalés sur deux ans ne disent rien, trois reports
 * d'affilée sans que la tâche ait été faite disent tout.
 */
export const RESISTING_FROM = 2;
export const DROP_FROM = 3;

const PEOPLE_SQL = `
  SELECT p.id, p.name, p.color,
         (SELECT COUNT(*) FROM completions c
           WHERE c.person_id = p.id AND c.skipped = 0 AND c.done_at >= ?1) AS done_last_7_days
  FROM people p ORDER BY p.id
`;

const RESISTING_SQL = `
  SELECT * FROM (
    SELECT t.id, t.title,
           d.id AS domain_id, d.name AS domain_name,
           p.id AS owner_id, p.name AS owner_name, p.color AS owner_color,
           (SELECT MAX(c.done_at) FROM completions c
             WHERE c.task_id = t.id AND c.skipped = 0) AS last_done_at,
           (SELECT COUNT(*) FROM completions c
             WHERE c.task_id = t.id AND c.skipped = 1
               AND c.done_at > COALESCE(
                 (SELECT MAX(c2.done_at) FROM completions c2
                   WHERE c2.task_id = t.id AND c2.skipped = 0), '')) AS skips
    FROM tasks t
    JOIN domains d ON d.id = t.domain_id
    JOIN people  p ON p.id = d.owner_id
    WHERE t.active = 1 AND d.active = 1
  )
  WHERE skips >= ?1
  ORDER BY skips DESC, title COLLATE NOCASE
`;

const DOMAINS_SQL = `
  SELECT d.id, d.name, d.minimum_standard, d.owner_id,
         (SELECT COUNT(*) FROM tasks t WHERE t.domain_id = d.id AND t.active = 1) AS active_tasks
  FROM domains d
  WHERE d.active = 1
  ORDER BY d.name COLLATE NOCASE
`;

interface ResistingRow {
  id: number;
  title: string;
  domain_id: number;
  domain_name: string;
  owner_id: number;
  owner_name: string;
  owner_color: string;
  last_done_at: string | null;
  skips: number;
}

export async function buildReview(
  db: D1Database,
  weeklyReviewWeekday: number,
  now: Date = new Date(),
): Promise<ReviewResponse> {
  const today = todayISO(now);
  const since = addDays(today, -(WINDOW_DAYS - 1));

  const [people, resisting, domains] = await db.batch([
    db.prepare(PEOPLE_SQL).bind(startOfDayUTC(since)),
    db.prepare(RESISTING_SQL).bind(RESISTING_FROM),
    db.prepare(DOMAINS_SQL),
  ]);

  return {
    since,
    people: people.results as ReviewPerson[],
    resisting: (resisting.results as ResistingRow[]).map(
      (row): ResistingTask => ({
        id: row.id,
        title: row.title,
        skips: row.skips,
        last_done_on: row.last_done_at === null ? null : row.last_done_at.slice(0, 10),
        domain: { id: row.domain_id, name: row.domain_name },
        owner: { id: row.owner_id, name: row.owner_name, color: row.owner_color },
      }),
    ),
    domains: domains.results as unknown as DomainView[],
    weekly_review_weekday: weeklyReviewWeekday,
    is_review_day: weekdayIndex(now) === weeklyReviewWeekday,
  };
}

/**
 * Réassignation au niveau du domaine, jamais de la tâche : c'est la seule
 * façon de déplacer la charge sans recréer la charge mentale qu'on supprime.
 */
export async function reassignDomain(
  db: D1Database,
  domainId: number,
  ownerId: number,
): Promise<{ ok: true } | { error: 'domain_not_found' | 'person_not_found' }> {
  const person = await db.prepare('SELECT id FROM people WHERE id = ?1').bind(ownerId).first<{ id: number }>();
  if (person === null) return { error: 'person_not_found' };

  const updated = await db
    .prepare('UPDATE domains SET owner_id = ?2 WHERE id = ?1 AND active = 1 RETURNING id')
    .bind(domainId, ownerId)
    .first<{ id: number }>();
  if (updated === null) return { error: 'domain_not_found' };

  return { ok: true };
}

/** Désactive sans supprimer : la revue a besoin de l'historique des semaines passées. */
export async function deactivateTask(
  db: D1Database,
  taskId: number,
): Promise<{ ok: true } | { error: 'task_not_found' }> {
  const updated = await db
    .prepare('UPDATE tasks SET active = 0 WHERE id = ?1 AND active = 1 RETURNING id')
    .bind(taskId)
    .first<{ id: number }>();
  return updated === null ? { error: 'task_not_found' } : { ok: true };
}
