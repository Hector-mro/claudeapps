import { addDays, todayISO } from './dates';

/** Une tâche repoussée revient dans deux jours — comptés à partir d'aujourd'hui. */
const SKIP_DAYS = 2;

/**
 * Fenêtre d'annulation. Assez longue pour rattraper un tap parti tout seul,
 * assez courte pour que la revue hebdomadaire ne soit pas réécrivable.
 */
const UNDO_WINDOW_MS = 5 * 60 * 1000;

const MAX_TITLE_LENGTH = 120;

interface TaskRow {
  id: number;
  kind: 'recurring' | 'oneoff';
  interval_days: number | null;
  next_due_on: string;
  active: number;
}

export type ActionError =
  | { error: 'task_not_found' }
  | { error: 'person_not_found' }
  | { error: 'domain_not_found' }
  | { error: 'empty_title' }
  | { error: 'completion_not_found' }
  | { error: 'undo_expired' }
  | { error: 'undo_unavailable' };

export interface CompletionResult {
  completion_id: number;
  next_due_on: string;
  removed: boolean;
}

async function loadTask(db: D1Database, taskId: number): Promise<TaskRow | null> {
  return db
    .prepare('SELECT id, kind, interval_days, next_due_on, active FROM tasks WHERE id = ?1 AND active = 1')
    .bind(taskId)
    .first<TaskRow>();
}

async function personExists(db: D1Database, personId: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM people WHERE id = ?1').bind(personId).first<{ id: number }>();
  return row !== null;
}

/**
 * Cocher une tâche.
 *
 * La récurrence repart de la date de réalisation, jamais de l'échéance
 * théorique : sinon un retard d'une semaine produit cinq tâches en retard
 * d'un coup, ce qui est démoralisant et inutile.
 *
 * Une tâche ponctuelle disparaît (active = 0) au lieu d'être supprimée :
 * la revue hebdomadaire a besoin de son historique.
 */
export async function completeTask(
  db: D1Database,
  taskId: number,
  personId: number,
  now: Date = new Date(),
): Promise<CompletionResult | ActionError> {
  const task = await loadTask(db, taskId);
  if (!task) return { error: 'task_not_found' };
  if (!(await personExists(db, personId))) return { error: 'person_not_found' };

  const today = todayISO(now);
  const isRecurring = task.kind === 'recurring' && task.interval_days !== null;
  const nextDueOn = isRecurring ? addDays(today, task.interval_days as number) : task.next_due_on;
  const stillActive = isRecurring ? 1 : 0;

  const [inserted] = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO completions (task_id, person_id, done_at, skipped, previous_next_due_on)
         VALUES (?1, ?2, ?3, 0, ?4) RETURNING id`,
      )
      .bind(taskId, personId, now.toISOString(), task.next_due_on),
    db.prepare('UPDATE tasks SET next_due_on = ?2, active = ?3 WHERE id = ?1').bind(taskId, nextDueOn, stillActive),
  ]);

  return {
    completion_id: inserted.results[0].id,
    next_due_on: nextDueOn,
    removed: stillActive === 0,
  };
}

/**
 * Repousser. On décale à partir d'aujourd'hui et non de l'échéance : « je le
 * ferai dans deux jours » est ce que la personne veut dire, et une tâche déjà
 * en retard ne doit pas rester en retard après avoir été repoussée.
 */
export async function skipTask(
  db: D1Database,
  taskId: number,
  personId: number,
  now: Date = new Date(),
): Promise<CompletionResult | ActionError> {
  const task = await loadTask(db, taskId);
  if (!task) return { error: 'task_not_found' };
  if (!(await personExists(db, personId))) return { error: 'person_not_found' };

  const nextDueOn = addDays(todayISO(now), SKIP_DAYS);

  const [inserted] = await db.batch<{ id: number }>([
    db
      .prepare(
        `INSERT INTO completions (task_id, person_id, done_at, skipped, previous_next_due_on)
         VALUES (?1, ?2, ?3, 1, ?4) RETURNING id`,
      )
      .bind(taskId, personId, now.toISOString(), task.next_due_on),
    db.prepare('UPDATE tasks SET next_due_on = ?2 WHERE id = ?1').bind(taskId, nextDueOn),
  ]);

  return { completion_id: inserted.results[0].id, next_due_on: nextDueOn, removed: false };
}

/** Annule un « fait » ou un « repoussé » récent et restaure l'échéance exacte. */
export async function undoCompletion(
  db: D1Database,
  completionId: number,
  now: Date = new Date(),
): Promise<{ task_id: number; next_due_on: string } | ActionError> {
  const row = await db
    .prepare('SELECT id, task_id, done_at, previous_next_due_on FROM completions WHERE id = ?1')
    .bind(completionId)
    .first<{ id: number; task_id: number; done_at: string; previous_next_due_on: string | null }>();

  if (!row) return { error: 'completion_not_found' };
  if (row.previous_next_due_on === null) return { error: 'undo_unavailable' };
  if (now.getTime() - Date.parse(row.done_at) > UNDO_WINDOW_MS) return { error: 'undo_expired' };

  await db.batch([
    db
      .prepare('UPDATE tasks SET next_due_on = ?2, active = 1 WHERE id = ?1')
      .bind(row.task_id, row.previous_next_due_on),
    db.prepare('DELETE FROM completions WHERE id = ?1').bind(completionId),
  ]);

  return { task_id: row.task_id, next_due_on: row.previous_next_due_on };
}

/**
 * Ajouter une tâche ponctuelle : un titre, un domaine, rien d'autre.
 * Elle est due aujourd'hui et marquée `low` — c'est le seul choix qui ne
 * demande pas une question de plus au moment de la saisie.
 */
export async function addOneoff(
  db: D1Database,
  title: string,
  domainId: number,
  now: Date = new Date(),
): Promise<{ id: number } | ActionError> {
  const trimmed = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (trimmed.length === 0) return { error: 'empty_title' };

  const domain = await db
    .prepare('SELECT id FROM domains WHERE id = ?1 AND active = 1')
    .bind(domainId)
    .first<{ id: number }>();
  if (!domain) return { error: 'domain_not_found' };

  const inserted = await db
    .prepare(
      `INSERT INTO tasks (domain_id, title, kind, trigger_cue, interval_days, next_due_on,
                          estimated_minutes, effort, active, created_at)
       VALUES (?1, ?2, 'oneoff', NULL, NULL, ?3, NULL, 'low', 1, ?4) RETURNING id`,
    )
    .bind(domainId, trimmed, todayISO(now), now.toISOString())
    .first<{ id: number }>();

  return { id: inserted!.id };
}
