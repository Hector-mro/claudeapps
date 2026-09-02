import { useCallback, useEffect, useState } from 'react';
import type { ReviewResponse } from '../shared/types';
import { api } from './api';
import css from './phone.module.css';

/**
 * Seuil à partir duquel la revue propose de retirer une tâche. Il double
 * celui du serveur, à dessein : c'est la même règle, écrite là où elle se
 * voit. Une tâche repoussée trois fois sans jamais être faite n'a pas sa
 * place dans le système.
 */
const DROP_FROM = 3;

function skipLabel(skips: number, lastDoneOn: string | null): string {
  return lastDoneOn === null
    ? 'repoussée ' + skips + ' fois · jamais faite'
    : 'repoussée ' + skips + ' fois depuis la dernière';
}

export function ReviewScreen({ token, onBack }: { token: string; onBack: () => void }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    return api
      .review(token)
      .then((payload) => {
        setData(payload);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function reassign(domainId: number, ownerId: number) {
    // Optimiste : la bascule doit répondre au doigt, la conversation continue.
    setData((current) =>
      current === null
        ? current
        : {
            ...current,
            domains: current.domains.map((domain) =>
              domain.id === domainId ? { ...domain, owner_id: ownerId } : domain,
            ),
          },
    );
    api.reassign(token, domainId, ownerId).then(refresh).catch(() => {
      setFailed(true);
      void refresh();
    });
  }

  function deactivate(taskId: number) {
    api.deactivate(token, taskId).then(refresh).catch(() => setFailed(true));
  }

  if (data === null) {
    return (
      <div className={css.screen}>
        <button type="button" className={css.backLink} onClick={onBack}>
          ← Aujourd'hui
        </button>
        {failed && <p className={css.error}>Impossible de joindre la maison.</p>}
      </div>
    );
  }

  return (
    <div className={css.screen}>
      <button type="button" className={css.backLink} onClick={onBack}>
        ← Aujourd'hui
      </button>

      <header className={css.header}>
        <div>
          <p className={css.kicker}>Depuis le {data.since.split('-').reverse().slice(0, 2).join('/')}</p>
          <h1 className={css.day}>Revue de la semaine</h1>
        </div>
      </header>

      {failed && <p className={css.error}>La dernière action n'est peut-être pas passée.</p>}

      <h2 className={css.sectionTitle}>Sept derniers jours</h2>
      <ul className={css.tally}>
        {data.people.map((person) => (
          <li key={person.id} className={css.tallyRow}>
            <span style={{ color: person.color }}>{person.name}</span>
            <span className={css.tallyCount}>
              {person.done_last_7_days} {person.done_last_7_days > 1 ? 'tâches' : 'tâche'}
            </span>
          </li>
        ))}
      </ul>

      {data.resisting.length > 0 && (
        <>
          <h2 className={css.sectionTitle}>Ça résiste</h2>
          {data.resisting.map((task) => (
            <div key={task.id} className={css.resistRow}>
              <span className={css.resistTitle}>{task.title}</span>
              <span className={css.resistMeta}>
                {task.domain.name} · <span style={{ color: task.owner.color }}>{task.owner.name}</span> ·{' '}
                {skipLabel(task.skips, task.last_done_on)}
              </span>
              {task.skips >= DROP_FROM && (
                <p className={css.resistVerdict}>
                  Repoussée {task.skips} fois sans être faite. Si elle ne se fait jamais, elle n'a pas sa
                  place ici.
                </p>
              )}
              <button type="button" className={css.smallAction} onClick={() => deactivate(task.id)}>
                Retirer du système
              </button>
            </div>
          ))}
        </>
      )}

      <h2 className={css.sectionTitle}>Domaines</h2>
      {data.domains.map((domain) => (
        <div key={domain.id} className={css.domainRow}>
          <span className={css.domainName}>{domain.name}</span>
          <p className={css.domainStandard}>{domain.minimum_standard}</p>
          <div className={css.owners}>
            {data.people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={css.ownerPick + (domain.owner_id === person.id ? ' ' + css.ownerPickOn : '')}
                onClick={() => reassign(domain.id, person.id)}
              >
                {person.name}
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* La liste des domaines est longue : on ne remonte pas trois écrans
          pour revenir à aujourd'hui. */}
      <button type="button" className={css.menuLink} onClick={onBack}>
        ← Aujourd'hui
      </button>
    </div>
  );
}
