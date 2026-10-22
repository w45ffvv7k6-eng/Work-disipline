import { useMemo, useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { MUSCLE_GROUP_LABELS, type Exercise, type ExerciseKind, type MuscleGroup } from '../../domain/types';
import { Sheet } from '../../ui/Sheet';
import { t } from '../../i18n';

interface Props {
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
}

const GROUPS = Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[];

/** Filtre « Favoris » (exercices les plus faits) et nombre maximum d'exercices montrés. */
const FAVORITES = 'favoris';
const FAVORITES_COUNT = 10;

/** Recherche sans tenir compte des accents ni des majuscules. */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function ExercisePicker({ onClose, onPick }: Props) {
  const { exercises } = useRepositories();
  const all = useSubscribable(() => exercises.watchAll(), []);
  const summaries = useSubscribable(() => exercises.watchSummaries(), []);
  const [query, setQuery] = useState('');
  // undefined = choix automatique : « Favoris » si la personne a déjà des exercices faits, sinon « Tous ».
  const [group, setGroup] = useState<MuscleGroup | null | typeof FAVORITES | undefined>(undefined);
  const hasFavorites = !!summaries && Object.keys(summaries).length > 0;
  const showFavorites = group === FAVORITES || (group === undefined && hasFavorites);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    const matches = (all ?? []).filter(
      (e) =>
        (showFavorites ? !!summaries?.[e.id] : !group || e.muscleGroup === group) &&
        (!q || normalize(t(e.name)).includes(q) || normalize(e.name).includes(q)),
    );
    // Favoris : les exercices les plus faits en premier.
    return showFavorites && summaries
      ? matches.sort((a, b) => summaries[b.id].sessionCount - summaries[a.id].sessionCount).slice(0, FAVORITES_COUNT)
      : matches;
  }, [all, query, group, showFavorites, summaries]);

  if (creating) {
    return (
      <CreateExerciseSheet
        initialName={query}
        initialGroup={group && group !== FAVORITES ? group : 'pectoraux'}
        onClose={() => setCreating(false)}
        onCreated={onPick}
      />
    );
  }

  return (
    <Sheet onClose={onClose} title={t('Ajouter un exercice')} full>
      {/* Deux façons : écrire son propre exercice, ou en choisir un dans la liste. */}
      <button className="btn btn-primary btn-block create-own" onClick={() => setCreating(true)}>
        ✏️ {t('Créer mon exercice (nom au choix)')}
      </button>
      <div className="picker-or">{t('ou choisis dans la liste')}</div>
      <input
        className="search"
        type="search"
        placeholder={t('Rechercher…')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={t('Rechercher un exercice')}
      />
      <div className="chips">
        <button className={`chip${showFavorites ? ' active' : ''}`} onClick={() => setGroup(FAVORITES)}>
          ⭐ {t('Favoris')}
        </button>
        <button className={`chip${!showFavorites && group == null ? ' active' : ''}`} onClick={() => setGroup(null)}>
          {t('Tous')}
        </button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
            {t(MUSCLE_GROUP_LABELS[g])}
          </button>
        ))}
      </div>
      <div className="list">
        {filtered.map((e) => (
          <button key={e.id} className="list-item" onClick={() => onPick(e)}>
            <div className="grow">
              <div className="title">{t(e.name)}</div>
              <div className="subtitle">
                {t(MUSCLE_GROUP_LABELS[e.muscleGroup])}
                {e.kind === 'bodyweight' && ` · ${t('poids du corps')}`}
                {e.kind === 'duration' && ` · ${t('durée')}`}
                {e.isCustom && ` · ${t('perso')}`}
              </div>
            </div>
          </button>
        ))}
        {all && filtered.length === 0 && (
          <div className="empty">
            {showFavorites && !query.trim()
              ? t('Tes exercices les plus faits apparaîtront ici après tes premières séances.')
              : t('Aucun exercice trouvé.')}
          </div>
        )}
        <button className="btn btn-outline btn-block" style={{ margin: '16px 0' }} onClick={() => setCreating(true)}>
          + {t('Créer un exercice')}
          {query.trim() ? ` « ${query.trim()} »` : ''}
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
    <Sheet onClose={onClose} title={t('Nouvel exercice')}>
      <div className="form-field">
        <label htmlFor="ex-name">{t('Nom')}</label>
        <input
          id="ex-name"
          className="search"
          value={name}
          placeholder={t('ex. {value}', { value: t('Curl araignée') })}
          onChange={(e) => setName(e.target.value)}
          // Pas d'autoFocus : sur iPhone le clavier s'ouvre au toucher.
          onTouchEnd={(e) => e.currentTarget.focus()}
          maxLength={60}
        />
      </div>
      <div className="form-field">
        <label>{t('Type')}</label>
        <div className="segmented">
          <button className={kind === 'weighted' ? 'active' : ''} onClick={() => setKind('weighted')}>
            {t('Charge')}
          </button>
          <button className={kind === 'bodyweight' ? 'active' : ''} onClick={() => setKind('bodyweight')}>
            {t('Poids du corps')}
          </button>
          <button className={kind === 'duration' ? 'active' : ''} onClick={() => setKind('duration')}>
            {t('Durée')}
          </button>
          <button
            className={kind === 'cardio' ? 'active' : ''}
            onClick={() => {
              setKind('cardio');
              setGroup('cardio');
            }}
          >
            {t('Cardio')}
          </button>
        </div>
      </div>
      <div className="form-field">
        <label>{t('Groupe musculaire')}</label>
        <div className="chips" style={{ flexWrap: 'wrap', paddingTop: 0 }}>
          {GROUPS.map((g) => (
            <button key={g} className={`chip${group === g ? ' active' : ''}`} onClick={() => setGroup(g)}>
              {t(MUSCLE_GROUP_LABELS[g])}
            </button>
          ))}
        </div>
      </div>
      <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={create}>
        {t('Créer et ajouter')}
      </button>
    </Sheet>
  );
}
