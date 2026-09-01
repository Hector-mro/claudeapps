import { useEffect, useRef, useState } from 'react';
import { api, type Domain } from './api';
import { Sheet } from './Sheet';
import css from './phone.module.css';

/**
 * Un titre, un domaine, rien d'autre — et trois taps au maximum depuis
 * l'ouverture de l'application : le « + », la pastille du domaine, « Ajouter ».
 * Le champ prend le focus tout seul, la saisie ne compte pas comme un tap.
 */
export function AddSheet({
  token,
  onClose,
  onAdded,
}: {
  token: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [domainId, setDomainId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .domains(token)
      .then((list) => {
        if (alive) setDomains(list);
      })
      .catch(() => {
        if (alive) setDomains([]);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const ready = title.trim().length > 0 && domainId !== null && !saving;

  function submit() {
    if (!ready) return;
    setSaving(true);
    setFailed(false);
    api
      .addOneoff(token, title, domainId)
      .then(() => onAdded())
      .catch(() => {
        setSaving(false);
        setFailed(true);
      });
  }

  return (
    <Sheet onClose={onClose}>
      <h2 className={css.sheetTitle}>Une chose à faire</h2>

      <input
        ref={input}
        className={css.field}
        value={title}
        placeholder="Rapporter le colis au relais"
        enterKeyHint="done"
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
      />

      <div className={css.chips}>
        {domains === null
          ? null
          : domains.map((domain) => (
              <button
                key={domain.id}
                type="button"
                className={css.chip + (domain.id === domainId ? ' ' + css.chipOn : '')}
                onClick={() => setDomainId(domain.id)}
              >
                {domain.name}
              </button>
            ))}
      </div>

      {failed && <p className={css.error}>L'ajout n'est pas passé. Réessaie.</p>}

      <div className={css.actions}>
        <button
          type="button"
          className={css.action + ' ' + css.actionPrimary}
          disabled={!ready}
          onClick={submit}
        >
          Ajouter
        </button>
      </div>
    </Sheet>
  );
}
