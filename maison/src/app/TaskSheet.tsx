import type { TaskView } from '../shared/types';
import { Sheet } from './Sheet';
import { lateLabel } from './TaskRow';
import css from './phone.module.css';

/**
 * Le standard minimum du domaine est la raison d'être de cet écran : une
 * phrase décidée à deux qui dit ce que « fait » veut dire. C'est ce qui
 * évite le micromanagement et les disputes sur la qualité.
 */
export function TaskSheet({
  task,
  onClose,
  onComplete,
  onSkip,
}: {
  task: TaskView;
  onClose: () => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  // Seul le prénom porte la couleur : le reste de la ligne est du contexte,
  // pas une information de propriété.
  const facts: string[] = [];
  if (task.estimated_minutes !== null) facts.push(task.estimated_minutes + ' min');
  facts.push(task.effort === 'low' ? 'effort faible' : 'effort élevé');
  const late = lateLabel(task.days_late);
  if (late !== null) facts.push('en retard ' + late);

  return (
    <Sheet onClose={onClose}>
      {task.trigger_cue !== null && <p className={css.cue}>{task.trigger_cue}</p>}
      <h2 className={css.sheetTitle}>{task.title}</h2>
      <p className={css.facts}>
        {task.domain.name} · <span style={{ color: task.owner.color }}>{task.owner.name}</span> ·{' '}
        {facts.join(' · ')}
      </p>

      <p className={css.standard}>
        <span className={css.standardLabel}>Standard minimum du domaine</span>
        {task.domain.minimum_standard}
      </p>

      <div className={css.actions}>
        <button type="button" className={css.action + ' ' + css.actionPrimary} onClick={onComplete}>
          Fait
        </button>
        <button type="button" className={css.action} onClick={onSkip}>
          Repoussé
        </button>
      </div>
    </Sheet>
  );
}
