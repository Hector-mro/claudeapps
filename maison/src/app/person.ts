// « Qui es-tu ? » est demandé une fois, puis mémorisé sur l'appareil.
// Pas de compte, pas de mot de passe : le jeton du foyer suffit à l'accès,
// cette valeur ne sert qu'à savoir qui coche.
const KEY = 'maison:person';

export function readPersonId(): number | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const id = raw === null ? NaN : Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    // Navigation privée, stockage refusé : on redemandera à chaque ouverture.
    return null;
  }
}

export function writePersonId(id: number): void {
  try {
    window.localStorage.setItem(KEY, String(id));
  } catch {
    /* sans effet : la session en mémoire suffit */
  }
}

export function clearPersonId(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* sans effet */
  }
}
