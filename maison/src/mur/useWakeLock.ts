import { useEffect } from 'react';

interface Sentinel {
  released: boolean;
  release: () => Promise<void>;
}

interface MaybeWakeLock {
  wakeLock?: { request?: (type: 'screen') => Promise<Sentinel> };
}

/**
 * Empêche la tablette de s'endormir.
 *
 * `navigator.wakeLock` n'existe pas sur les moteurs anciens : le repli est
 * silencieux, et le README documente qu'il faut alors régler la veille dans
 * les réglages système de la tablette.
 *
 * Le verrou est perdu dès que la page passe en arrière-plan (écran verrouillé,
 * changement d'onglet) : d'où la réacquisition sur `visibilitychange`.
 */
export function useWakeLock(): void {
  useEffect(() => {
    const api = (navigator as unknown as MaybeWakeLock).wakeLock;
    if (!api || typeof api.request !== 'function') return;

    let sentinel: Sentinel | null = null;
    let stopped = false;

    function acquire() {
      if (stopped || (sentinel !== null && !sentinel.released)) return;
      api!.request!('screen').then(
        (granted) => {
          if (stopped) {
            void granted.release();
          } else {
            sentinel = granted;
          }
        },
        () => {
          // Refus du navigateur (onglet caché, batterie faible) : sans effet.
        },
      );
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') acquire();
    }

    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sentinel !== null && !sentinel.released) void sentinel.release();
    };
  }, []);
}
