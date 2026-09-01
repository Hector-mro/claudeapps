import type { Person } from '../shared/types';
import css from './phone.module.css';

export function WhoAreYou({ people, onPick }: { people: Person[]; onPick: (id: number) => void }) {
  return (
    <div className={css.gate}>
      <p className={css.kicker}>Maison</p>
      <h1 className={css.gateTitle}>Qui es-tu ?</h1>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          className={css.gateChoice}
          style={{ color: person.color }}
          onClick={() => onPick(person.id)}
        >
          {person.name}
        </button>
      ))}
    </div>
  );
}
