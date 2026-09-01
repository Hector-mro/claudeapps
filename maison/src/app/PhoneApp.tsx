import { useCallback, useEffect, useState } from 'react';
import type { TaskView, TodayResponse } from '../shared/types';
import { AddSheet } from './AddSheet';
import { api } from './api';
import { clearPersonId, readPersonId, writePersonId } from './person';
import { TaskRow } from './TaskRow';
import { ReviewScreen } from './ReviewScreen';
import { TaskSheet } from './TaskSheet';
import { WhoAreYou } from './WhoAreYou';
import css from './phone.module.css';

/** Fenêtre d'annulation côté interface. Le serveur en accorde cinq minutes. */
const UNDO_MS = 7000;

interface Undoable {
  completionId: number;
  label: string;
}

/** Le menu tient en une entrée : il n'y a rien d'autre à atteindre. */
function reviewPath(token: string): string {
  return '/app/' + token + '/revue';
}

export function PhoneApp({ token }: { token: string }) {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [onReview, setOnReview] = useState(() => window.location.pathname === reviewPath(token));
  const [pushed, setPushed] = useState(false);
  const [personId, setPersonId] = useState<number | null>(readPersonId);
  const [openTask, setOpenTask] = useState<TaskView | null>(null);
  const [adding, setAdding] = useState(false);
  const [undoable, setUndoable] = useState<Undoable | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    return api
      .today(token)
      .then((payload) => {
        setData(payload);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [token]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Le bouton « retour » du téléphone doit ramener à la liste du jour,
  // pas quitter l'application.
  useEffect(() => {
    function onPop() {
      setOnReview(window.location.pathname === reviewPath(token));
    }
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [token]);

  useEffect(() => {
    if (undoable === null) return;
    const timer = window.setTimeout(() => setUndoable(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [undoable]);

  /** Retire la ligne tout de suite : le retour doit être immédiat, pas « en cours ». */
  function removeLocally(taskId: number) {
    setData((current) =>
      current === null
        ? current
        : {
            ...current,
            today: current.today.filter((task) => task.id !== taskId),
            slipped: current.slipped.filter((task) => task.id !== taskId),
          },
    );
  }

  function act(task: TaskView, kind: 'complete' | 'skip') {
    if (personId === null) return;
    setOpenTask(null);
    removeLocally(task.id);
    const call = kind === 'complete' ? api.complete : api.skip;
    call(token, task.id, personId)
      .then((result) => {
        setUndoable({
          completionId: result.completion_id,
          label: kind === 'complete' ? 'Fait : ' + task.title : 'Repoussé : ' + task.title,
        });
        return refresh();
      })
      .catch(() => {
        setFailed(true);
        return refresh();
      });
  }

  function undo() {
    if (undoable === null) return;
    const { completionId } = undoable;
    setUndoable(null);
    api
      .undo(token, completionId)
      .then(refresh)
      .catch(() => setFailed(true));
  }

  function openReview() {
    window.history.pushState(null, '', reviewPath(token));
    setPushed(true);
    setOnReview(true);
  }

  function closeReview() {
    if (pushed) {
      window.history.back();
      setPushed(false);
    } else {
      // Arrivé directement sur /revue : rien à dépiler, on réécrit l'URL.
      window.history.replaceState(null, '', '/app/' + token);
    }
    setOnReview(false);
    void refresh();
  }

  if (onReview) return <ReviewScreen token={token} onBack={closeReview} />;

  if (data === null) {
    return (
      <div className={css.screen}>
        {failed ? <p className={css.error}>Impossible de joindre la maison.</p> : null}
      </div>
    );
  }

  const person = data.people.find((candidate) => candidate.id === personId) ?? null;
  if (person === null) {
    return (
      <WhoAreYou
        people={data.people}
        onPick={(id) => {
          writePersonId(id);
          setPersonId(id);
        }}
      />
    );
  }

  return (
    <div className={css.screen}>
      <header className={css.header}>
        <div>
          <p className={css.kicker}>Maison</p>
          <h1 className={css.day}>{data.day_label}</h1>
        </div>
        <button
          type="button"
          className={css.whoChip}
          style={{ color: person.color }}
          onClick={() => {
            clearPersonId();
            setPersonId(null);
          }}
        >
          {person.name}
        </button>
      </header>

      {failed && <p className={css.error}>La dernière action n'est peut-être pas passée.</p>}

      {data.is_review_day && (
        <button type="button" className={css.reviewBanner} onClick={openReview}>
          C'est le jour de la revue. Vingt minutes à deux.
        </button>
      )}

      {data.today.length === 0 && data.slipped.length === 0 ? (
        <p className={css.empty}>Rien aujourd'hui. C'est le but.</p>
      ) : null}

      {data.today.length > 0 && (
        <ul className={css.list}>
          {data.today.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onComplete={() => act(task, 'complete')}
              onOpen={() => setOpenTask(task)}
            />
          ))}
        </ul>
      )}

      {data.slipped.length > 0 && (
        <>
          <h2 className={css.sectionTitle}>Ça a glissé</h2>
          <ul className={css.list + ' ' + css.slipped}>
            {data.slipped.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onComplete={() => act(task, 'complete')}
                onOpen={() => setOpenTask(task)}
              />
            ))}
          </ul>
        </>
      )}

      <button type="button" className={css.menuLink} onClick={openReview}>
        Revue de la semaine
      </button>

      <button
        type="button"
        className={css.fab + (undoable !== null ? ' ' + css.fabRaised : '')}
        aria-label="Ajouter une tâche"
        onClick={() => setAdding(true)}
      >
        +
      </button>

      {openTask !== null && (
        <TaskSheet
          task={openTask}
          onClose={() => setOpenTask(null)}
          onComplete={() => act(openTask, 'complete')}
          onSkip={() => act(openTask, 'skip')}
        />
      )}

      {adding && (
        <AddSheet
          token={token}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            void refresh();
          }}
        />
      )}

      {undoable !== null && (
        <div className={css.undo} role="status">
          <span>{undoable.label}</span>
          <button type="button" className={css.undoButton} onClick={undo}>
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}
