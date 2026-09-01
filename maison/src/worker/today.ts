import type { Person, TaskView, TodayResponse } from '../shared/types';
import { dayLabel, daysBetween, todayISO, weekdayIndex } from './dates';

/**
 * Au-delà de ce retard, une tâche quitte « Aujourd'hui » pour « Ça a glissé ».
 * Elle n'est pas montrée deux fois : une dette de trois semaines n'est plus
 * le plan du jour, et la laisser en tête des 5 lignes du mur remplirait
 * l'écran de reproches — exactement ce qui produit de l'évitement.
 */
const SLIPPED_AFTER_DAYS = 7;
const SLIPPED_MAX = 3;

interface Row {
  id: number;
  title: string;
  kind: string;
  trigger_cue: string | null;
  effort: string;
  estimated_minutes: number | null;
  next_due_on: string;
  domain_id: number;
  domain_name: string;
  minimum_standard: string;
  owner_id: number;
  owner_name: string;
  owner_color: string;
}

const DUE_SQL = `
  SELECT t.id, t.title, t.kind, t.trigger_cue, t.effort, t.estimated_minutes, t.next_due_on,
         d.id AS domain_id, d.name AS domain_name, d.minimum_standard,
         p.id AS owner_id, p.name AS owner_name, p.color AS owner_color
  FROM tasks t
  JOIN domains d ON d.id = t.domain_id
  JOIN people  p ON p.id = d.owner_id
  WHERE t.active = 1 AND d.active = 1 AND t.next_due_on <= ?1
  ORDER BY t.next_due_on ASC, t.id ASC
`;

function toView(row: Row, today: string): TaskView {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as TaskView['kind'],
    trigger_cue: row.trigger_cue,
    effort: row.effort as TaskView['effort'],
    estimated_minutes: row.estimated_minutes,
    next_due_on: row.next_due_on,
    days_late: Math.max(0, daysBetween(row.next_due_on, today)),
    domain: { id: row.domain_id, name: row.domain_name, minimum_standard: row.minimum_standard },
    owner: { id: row.owner_id, name: row.owner_name, color: row.owner_color },
  };
}

/**
 * Tri du mur, repris tel quel par le téléphone (§5 de la spec) :
 * les tâches en retard d'abord, puis par échéance, puis l'effort faible
 * avant l'effort élevé — pour qu'un soir de fatigue propose quelque chose
 * de tenable plutôt que le gros morceau.
 */
export function sortForDisplay(tasks: TaskView[]): TaskView[] {
  return tasks.slice().sort((a, b) => {
    const lateA = a.days_late > 0 ? 0 : 1;
    const lateB = b.days_late > 0 ? 0 : 1;
    if (lateA !== lateB) return lateA - lateB;
    if (a.next_due_on !== b.next_due_on) return a.next_due_on < b.next_due_on ? -1 : 1;
    const effortA = a.effort === 'low' ? 0 : 1;
    const effortB = b.effort === 'low' ? 0 : 1;
    if (effortA !== effortB) return effortA - effortB;
    return a.id - b.id;
  });
}

export async function buildToday(
  db: D1Database,
  weeklyReviewWeekday: number,
  now: Date = new Date(),
): Promise<TodayResponse> {
  const today = todayISO(now);

  const [due, people] = await db.batch<Row | Person>([
    db.prepare(DUE_SQL).bind(today),
    db.prepare('SELECT id, name, color FROM people ORDER BY id'),
  ]);

  const views = (due.results as Row[]).map((row) => toView(row, today));

  const slipped = views
    .filter((t) => t.days_late > SLIPPED_AFTER_DAYS)
    .sort((a, b) => b.days_late - a.days_late)
    .slice(0, SLIPPED_MAX);

  return {
    date: today,
    day_label: dayLabel(now),
    today: sortForDisplay(views.filter((t) => t.days_late <= SLIPPED_AFTER_DAYS)),
    slipped,
    people: people.results as Person[],
    weekly_review_weekday: weeklyReviewWeekday,
    is_review_day: weekdayIndex(now) === weeklyReviewWeekday,
  };
}
