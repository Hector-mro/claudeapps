// Le foyer vit à Paris ; le Worker tourne en UTC et SQLite ne connaît que l'UTC.
// Toute date de calendrier ('YYYY-MM-DD') traverse donc ces trois fonctions,
// jamais un `new Date().toISOString().slice(0, 10)` — qui décale d'un jour
// chaque soir entre 22 h et minuit l'été.

export const HOUSEHOLD_TZ = 'Europe/Paris';

const ISO_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: HOUSEHOLD_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const DAY_LABEL = new Intl.DateTimeFormat('fr-FR', {
  timeZone: HOUSEHOLD_TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const WEEKDAY_INDEX = new Intl.DateTimeFormat('en-US', {
  timeZone: HOUSEHOLD_TZ,
  weekday: 'short',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Date du jour dans le foyer, 'YYYY-MM-DD'. */
export function todayISO(now: Date = new Date()): string {
  return ISO_DAY.format(now);
}

/** « mardi 1 septembre ». */
export function dayLabel(now: Date = new Date()): string {
  return DAY_LABEL.format(now);
}

/** 0 = dimanche … 6 = samedi, dans le fuseau du foyer. */
export function weekdayIndex(now: Date = new Date()): number {
  return WEEKDAYS.indexOf(WEEKDAY_INDEX.format(now));
}

function toUTCms(iso: string): number {
  const parts = iso.split('-');
  return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

/** Nombre de jours calendaires de `from` à `to`. Négatif si `to` précède `from`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUTCms(to) - toUTCms(from)) / 86400000);
}

/** Décale une date de calendrier, sans jamais passer par une heure locale. */
export function addDays(iso: string, days: number): string {
  const shifted = new Date(toUTCms(iso) + days * 86400000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

/**
 * Décalage du fuseau du foyer par rapport à UTC, à cet instant précis.
 * `sv-SE` produit « 2026-09-01 14:30:00 », qu'on relit comme si c'était de
 * l'UTC : l'écart mesuré est le décalage réel, changement d'heure compris.
 */
const LOCAL_STAMP = new Intl.DateTimeFormat('sv-SE', {
  timeZone: HOUSEHOLD_TZ,
  dateStyle: 'short',
  timeStyle: 'medium',
  hour12: false,
});

function offsetMs(at: Date): number {
  return Date.parse(LOCAL_STAMP.format(at).replace(' ', 'T') + 'Z') - at.getTime();
}

/**
 * Minuit à Paris pour une date de calendrier, exprimé en UTC — la borne
 * exacte d'un « depuis sept jours », alors qu'une comparaison naïve en UTC
 * se trompe de deux heures chaque soir.
 */
export function startOfDayUTC(day: string): string {
  const naive = Date.parse(day + 'T00:00:00Z');
  const first = naive - offsetMs(new Date(naive));
  // Deuxième passe : la nuit du changement d'heure, le décalage à minuit
  // n'est pas celui de l'instant de départ.
  return new Date(naive - offsetMs(new Date(first))).toISOString();
}
