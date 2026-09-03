import type { TaskView } from '../shared/types';
import css from './phone.module.css';

export function lateLabel(days: number): string | null {
  if (days <= 0) return null;
  if (days === 1) return 'depuis hier';
  return 'depuis ' + days + ' jours';
}

export function TaskRow({
  task,
  onComplete,
  onOpen,
}: {
  task: TaskView;
  onComplete: () => void;
  onOpen: () => void;
}) {
  const late = lateLabel(task.days_late);

  return (
    <li className={css.row}>
      <button type="button" className={css.rowMain} onClick={onComplete}>
        {task.trigger_cue !== null && <span className={css.cue}>{task.trigger_cue}</span>}
        <span className={css.title}>{task.title}</span>
        <span className={css.owner} style={{ color: task.owner.color }}>
          {task.owner.name}
          {late !== null && <span className={css.late}> · {late}</span>}
        </span>
      </button>
      <button type="button" className={css.rowMore} onClick={onOpen} aria-label={'Ouvrir ' + task.title}>
        ⋯
      </button>
    </li>
  );
}
