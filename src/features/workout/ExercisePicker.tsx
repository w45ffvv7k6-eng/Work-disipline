import { useMemo, useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { MUSCLE_GROUP_LABELS, type Exercise, type ExerciseKind, type MuscleGroup } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';

interface Props {
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}

const GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

/** Recherche sans tenir compte des accents ni des majuscules. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ExercisePicker({ onClose, onPick }: Props) {
  const { exercises } = useRepositories();
  const all = useSubscribable(() => exercises.watchAll(), []);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return (all ?? []).filter((e) => (!group || e.muscleGroup === group) && (!q || normalize(e.name).includes(q)));
  }, [all, query, group]);

  if (creating) {
    return (
      <CreateExerciseSheet
        initialName={query}
        initialGroup={group ?? 'pectoraux'}
        onClose={() => setCreating(false)}
        onCreated={onPick}
      />
    );
  }

  return (
    <Sheet onClose={onClose} title="Ajouter un exercice" full>
      <input
        className="search"
        type="search"
        placeholder="Rechercher…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Rechercher un exercice"
      />
      <div className="chips">
        <button className={`chip${group === null ? ' active' : ''}`} onClick={() => setGroup(null)}>
          Tous
        </button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
            {MUSCLE_GROUP_LABELS[g]}
          </button>
        ))}
      </div>
      <div className="list">
        {filtered.map((e) => (
          <button key={e.id} className="list-item" onClick={() => onPick(e)}>
            <div className="grow">
              <div className="title">{e.name}</div>
              <div className="subtitle">
                {MUSCLE_GROUP_LABELS[e.muscleGroup]}
                {e.kind === 'bodyweight' && ' · poids du corps'}
                {e.kind === 'duration' && ' · durée'}
                {e.isCustom && ' · perso'}
              </div>
            </div>
          </button>
        ))}
        {all && filtered.length === 0 && <div className="empty">Aucun exercice trouvé.</div>}
        <button className="btn btn-outline btn-block" style={{ margin: '16px 0' }} onClick={() => setCreating(true)}>
          + Créer un exercice{query.trim() ? ` « ${query.trim()} »` : ''}
        </button>
      </div>
    </Sheet>
  );
}

function CreateExerciseSheet({
  initialName,
  initialGroup,
  onClose,
  onCreated,
}: {
  initialName: string;
  initialGroup: MuscleGroup;
  onClose: () => void;
  onCreated: (e: Exercise) => void;
}) {
  const { exercises } = useRepositories();
  const [name, setName] = useState(initialName.trim());
  const [group, setGroup] = useState<MuscleGroup>(initialGroup);
  const [kind, setKind] = useState<ExerciseKind>('weighted');

  const create = async () => {
    const exercise = await exercises.create({ name: name.trim(), muscleGroup: group, kind });
    onCreated(exercise);
  };

  return (
    <Sheet onClose={onClose} title="Nouvel exercice">
      <div className="form-field">
        <label htmlFor="ex-name">Nom</label>
        <input id="ex-name" className="search" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div className="form-field">
        <label>Type</label>
        <div className="segmented">
          <button className={kind === 'weighted' ? 'active' : ''} onClick={() => setKind('weighted')}>
            Charge
          </button>
          <button className={kind === 'bodyweight' ? 'active' : ''} onClick={() => setKind('bodyweight')}>
            Poids du corps
          </button>
          <button className={kind === 'duration' ? 'active' : ''} onClick={() => setKind('duration')}>
            Durée
          </button>
          <button
            className={kind === 'cardio' ? 'active' : ''}
            onClick={() => {
              setKind('cardio');
              setGroup('cardio');
            }}
          >
            Cardio
          </button>
        </div>
      </div>
      <div className="form-field">
        <label>Groupe musculaire</label>
        <div className="chips" style={{ flexWrap: 'wrap', paddingTop: 0 }}>
          {GROUPS.map((g) => (
            <button key={g} className={`chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
              {MUSCLE_GROUP_LABELS[g]}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={create}>
        Créer et ajouter
      </button>
    </Sheet>
  );
}
