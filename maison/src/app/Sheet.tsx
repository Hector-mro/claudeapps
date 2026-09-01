import { useEffect, type ReactNode } from 'react';
import css from './phone.module.css';

/** Feuille montante : les actions restent à portée du pouce. */
export function Sheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <button type="button" className={css.backdrop} aria-label="Fermer" onClick={onClose} />
      <div className={css.sheet} role="dialog" aria-modal="true">
        <div className={css.sheetInner}>{children}</div>
      </div>
    </>
  );
}
