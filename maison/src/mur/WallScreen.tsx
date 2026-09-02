import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TodayResponse } from '../shared/types';
import { api } from '../app/api';
import { useWakeLock } from './useWakeLock';
import css from './wall.module.css';

/**
 * Plafond dur. Un mur qui affiche quatorze tâches produit de l'évitement,
 * pas de l'action. Au-delà de cinq, on tronque et on dit « +N ».
 */
const WALL_MAX = 5;

const REFRESH_MS = 60000;

/** Sans réponse depuis dix minutes, le mur le dit. Voir plus bas. */
const STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Rechargement de nuit.
 *
 * Le mur ne recharge jamais la page de lui-même : il tourne des semaines sur
 * le même bundle. Après un déploiement, il continuerait donc à exécuter
 * l'ancien code jusqu'à ce que quelqu'un traverse le salon pour le rafraîchir
 * à la main. Un rechargement quotidien à 4 h — personne devant l'écran —
 * suffit à ce qu'une mise en ligne finisse par arriver toute seule, et purge
 * au passage ce qu'un navigateur de tablette peut accumuler en un mois.
 *
 * La garde d'ancienneté évite qu'un mur allumé à 4 h 00 boucle sur lui-même.
 */
const RELOAD_HOUR = 4;
const MIN_UPTIME_BEFORE_RELOAD_MS = 2 * 60 * 60 * 1000;

/**
 * Réduction typographique par paliers quand le contenu déborde. Le plancher
 * n'est pas une constante mais se déduit de la seule règle qui compte :
 * un titre lisible à trois mètres ne descend pas sous 40 px. Quand les deux
 * exigences se contredisent — écran trop court pour cinq tâches ET la
 * section « Ça a glissé » —, c'est la lisibilité qui l'emporte et le bas
 * de l'écran qui est rogné. Sur une tablette 10 pouces (1280×800 ou
 * 800×1280), le cas ne se présente pas : le pire contenu tient à 41 px.
 */
const SCALE_STEP = 0.04;
const MIN_TITLE_PX = 40;

/** Nuit : très sombre, faible contraste, pour ne pas éclairer le salon. */
function isNight(now: Date): boolean {
  const hour = now.getHours();
  return hour >= 22 || hour < 7;
}

function hhmm(at: Date): string {
  return String(at.getHours()).padStart(2, '0') + ':' + String(at.getMinutes()).padStart(2, '0');
}

/**
 * Signature de ce qui est réellement affiché. Sur un écran allumé en
 * permanence, les reflows visibles sont fatigants : tant que cette chaîne
 * ne bouge pas, l'état React reste identique, React ne re-rend pas, et le
 * DOM n'est pas touché.
 */
function signature(data: TodayResponse): string {
  const shown = data.today
    .slice(0, WALL_MAX)
    .map((task) => task.id + '|' + task.title + '|' + task.trigger_cue + '|' + task.owner.name + '|' + task.owner.color)
    .join(';');
  const slipped = data.slipped
    .map((task) => task.id + '|' + task.title + '|' + task.days_late + '|' + task.owner.name)
    .join(';');
  return [data.day_label, shown, String(data.today.length - WALL_MAX), slipped].join('#');
}

interface View {
  data: TodayResponse;
  sig: string;
}

export function WallScreen({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [night, setNight] = useState(() => isNight(new Date()));
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const lastSuccess = useRef(Date.now());
  const loadedAt = useRef(Date.now());
  const shellRef = useRef<HTMLDivElement>(null);

  useWakeLock();

  /**
   * Le mur ne défile pas : ce qui dépasse est simplement invisible, et
   * personne ne s'en aperçoit. On mesure donc après chaque changement de
   * contenu — et après chaque rotation de la tablette — puis on réduit
   * jusqu'à ce que tout tienne.
   */
  useLayoutEffect(() => {
    function fit() {
      const shell = shellRef.current;
      if (shell === null) return;

      shell.style.setProperty('--scale', '1');
      const title = shell.querySelector('[data-title]');
      const basePx = title === null ? 0 : parseFloat(window.getComputedStyle(title).fontSize);
      const floor = basePx > MIN_TITLE_PX ? MIN_TITLE_PX / basePx : 1;

      let scale = 1;
      while (shell.scrollHeight > shell.clientHeight && scale > floor) {
        scale = Math.max(floor, scale - SCALE_STEP);
        shell.style.setProperty('--scale', String(scale));
      }
    }

    fit();
    // `orientationchange` en plus de `resize` : sur les moteurs anciens, la
    // rotation ne déclenche pas toujours le second.
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, [view]);

  useEffect(() => {
    let stopped = false;

    function tick() {
      const now = new Date();

      if (
        now.getHours() === RELOAD_HOUR &&
        Date.now() - loadedAt.current > MIN_UPTIME_BEFORE_RELOAD_MS
      ) {
        window.location.reload();
        return;
      }

      // La bascule jour/nuit est réévaluée à chaque battement : identique,
      // React abandonne le rendu tout seul.
      setNight(isNight(now));

      api.today(token).then(
        (data) => {
          if (stopped) return;
          lastSuccess.current = Date.now();
          setStaleSince(null);
          const sig = signature(data);
          setView((current) => (current !== null && current.sig === sig ? current : { data, sig }));
        },
        () => {
          if (stopped) return;
          // On garde le dernier contenu connu à l'écran : mieux vaut une
          // liste d'il y a dix minutes qu'un mur vide.
          if (Date.now() - lastSuccess.current > STALE_AFTER_MS) {
            setStaleSince(hhmm(new Date(lastSuccess.current)));
          }
        },
      );
    }

    tick();
    const timer = window.setInterval(tick, REFRESH_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [token]);

  const shell = css.wall + (night ? ' ' + css.night : '');

  if (view === null) return <div ref={shellRef} className={shell} />;

  const { data } = view;
  const shown = data.today.slice(0, WALL_MAX);
  const overflow = data.today.length - shown.length;

  return (
    <div ref={shellRef} className={shell}>
      {/* Le jour, et rien d'autre. Pas d'heure qui s'anime. */}
      <p className={css.day}>{data.day_label}</p>

      {shown.length === 0 && data.slipped.length === 0 ? (
        <p className={css.empty}>Rien aujourd'hui.</p>
      ) : null}

      {shown.length > 0 && (
        <ul className={css.list}>
          {shown.map((task) => (
            <li key={task.id} className={css.task}>
              {task.trigger_cue !== null && <div className={css.cue}>{task.trigger_cue}</div>}
              <div className={css.title} data-title>
                {task.title}
              </div>
              <div className={css.owner} style={{ color: task.owner.color }}>
                {task.owner.name}
              </div>
            </li>
          ))}
        </ul>
      )}

      {overflow > 0 && <p className={css.overflow}>+{overflow}</p>}

      {data.slipped.length > 0 && (
        <div className={css.slipped}>
          <p className={css.slippedLabel}>Ça a glissé</p>
          {data.slipped.map((task) => (
            <div key={task.id} className={css.slippedItem}>
              {task.title}{' '}
              <span className={css.slippedOwner}>
                {task.owner.name} <span className={css.late}>· {task.days_late} jours</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {staleSince !== null && <div className={css.stale}>hors ligne depuis {staleSince}</div>}
    </div>
  );
}
