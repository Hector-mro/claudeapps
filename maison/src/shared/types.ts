// Contrat partagé entre le Worker et les deux interfaces.
// Aucune dépendance : ce fichier est importé côté Workers comme côté navigateur.

export type Effort = 'low' | 'high';
export type TaskKind = 'recurring' | 'oneoff';

export interface Person {
  id: number;
  name: string;
  color: string;
}

export interface TaskView {
  id: number;
  title: string;
  kind: TaskKind;
  /** Ce qu'on affiche au mur. Toujours présent pour une tâche récurrente. */
  trigger_cue: string | null;
  effort: Effort;
  estimated_minutes: number | null;
  next_due_on: string;
  /** 0 si la tâche est due aujourd'hui, > 0 si elle est en retard. */
  days_late: number;
  domain: { id: number; name: string; minimum_standard: string };
  owner: Person;
}

export interface TodayResponse {
  /** Date du foyer (Europe/Paris), 'YYYY-MM-DD'. */
  date: string;
  /** « mardi 1 septembre » — le mur n'affiche rien d'autre comme contexte. */
  day_label: string;
  /**
   * Tâches dues ou en retard d'au plus 7 jours, déjà triées.
   * Non plafonnée : le mur en prend 5, le téléphone les prend toutes.
   */
  today: TaskView[];
  /** Retard de plus de 7 jours, 3 au maximum, les plus anciennes d'abord. */
  slipped: TaskView[];
  people: Person[];
  /** 0 = dimanche … 6 = samedi. */
  weekly_review_weekday: number;
  is_review_day: boolean;
}

/* — Revue hebdomadaire — */

export interface ReviewPerson extends Person {
  /**
   * Tâches accomplies sur 7 jours. Seul chiffre que le système affiche sur
   * les personnes : pas de score, pas de classement, pas d'historique.
   */
  done_last_7_days: number;
}

export interface ResistingTask {
  id: number;
  title: string;
  /** Reports consécutifs depuis la dernière fois que la tâche a été faite. */
  skips: number;
  /** null si elle n'a jamais été faite. */
  last_done_on: string | null;
  domain: { id: number; name: string };
  owner: Person;
}

export interface DomainView {
  id: number;
  name: string;
  minimum_standard: string;
  owner_id: number;
  active_tasks: number;
}

export interface ReviewResponse {
  /** Début de la fenêtre de 7 jours, 'YYYY-MM-DD'. */
  since: string;
  people: ReviewPerson[];
  /** Tâches repoussées au moins deux fois d'affilée, les plus tenaces d'abord. */
  resisting: ResistingTask[];
  domains: DomainView[];
  weekly_review_weekday: number;
  is_review_day: boolean;
}
