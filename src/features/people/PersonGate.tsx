import Dexie from 'dexie';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { db } from '../../data';
import { hasPersonalData } from '../../data/backup';
import { dbNameFor, people, type Person } from '../../data/people';
import { useFeedback } from '../../ui/feedback';
import { initials } from '../../ui/PageHeader';
import { splashPhotoUrl } from '../../ui/splashPhotos';

/** Passe à une autre personne : sa base de données est chargée au redémarrage de l'appli. */
export function switchPerson(id: string | undefined) {
  people.select(id);
  // Redémarre l'appli sur l'onglet Programme (adresse sans « # » : rechargement complet).
  window.location.href = window.location.pathname + window.location.search;
}

/**
 * Tant que personne n'est identifié sur ce téléphone, affiche « Qui s'entraîne ? ».
 * Une fois une personne choisie, elle le reste jusqu'à « Changer de personne ».
 */
export function PersonGate({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState(people.activeId());
  const [ready, setReady] = useState(false);

  // Données saisies avant l'arrivée des personnes : elles deviennent celles de la personne d'origine.
  useEffect(() => {
    void (async () => {
      if (people.list().length === 0 && (await hasPersonalData(db))) {
        const profile = await db.profile.get('profile');
        people.ensureDefault(profile?.firstName || 'Moi');
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  if (activeId && people.active()) return <>{children}</>;

  const choose = (person: Person) => {
    // La base déjà ouverte est celle de cette personne : pas besoin de redémarrer.
    if (dbNameFor(person.id) === db.name) {
      people.select(person.id);
      setActiveId(person.id);
    } else {
      switchPerson(person.id);
    }
  };

  return <PersonPicker onChoose={choose} />;
}

function PersonPicker({ onChoose }: { onChoose: (p: Person) => void }) {
  const { confirm } = useFeedback();
  const [list, setList] = useState(people.list());
  const [adding, setAdding] = useState(list.length === 0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onChoose(people.add(name));
  };

  const remove = async (person: Person) => {
    const ok = await confirm({
      title: `Supprimer ${person.name} ?`,
      message: 'Toutes ses séances, son programme et son profil seront définitivement effacés de ce téléphone.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    const name = dbNameFor(person.id);
    if (name === db.name) await db.delete();
    else await Dexie.delete(name);
    people.remove(person.id);
    const rest = people.list();
    setList(rest);
    if (rest.length === 0) {
      // Plus personne : on repart d'une base neuve.
      window.location.reload();
    }
  };

  return (
    <div className="auth" style={{ backgroundImage: `url("${splashPhotoUrl('salle.webp')}")` }}>
      <div className="auth-shade" />
      <div className="auth-card">
        <div className="auth-wordmark" style={{ textAlign: 'center', marginBottom: 6 }}>
          WORK <span>&amp;</span> DISCIPLINE
        </div>
        <h1 className="who-title">{adding ? 'Comment tu t’appelles ?' : 'Qui s’entraîne ?'}</h1>

        {!adding && (
          <>
            <div className="people-grid">
              {list.map((p, i) => (
                <div key={p.id} className="person" style={{ animationDelay: `${i * 0.06}s` }}>
                  <button className="person-btn" onClick={() => (editing ? undefined : onChoose(p))}>
                    <span className="avatar person-avatar">{initials(p.name || '?')}</span>
                    <span className="person-name">{p.name || 'Sans nom'}</span>
                  </button>
                  {editing && (
                    <button className="person-remove" onClick={() => remove(p)} aria-label={`Supprimer ${p.name}`}>
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {!editing && (
                <button className="person person-btn person-add" onClick={() => setAdding(true)}>
                  <span className="avatar person-avatar add">+</span>
                  <span className="person-name">Ajouter</span>
                </button>
              )}
            </div>
            {list.length > 0 && (
              <button className="link-btn auth-link" onClick={() => setEditing(!editing)}>
                {editing ? 'Terminé' : 'Gérer les personnes'}
              </button>
            )}
          </>
        )}

        {adding && (
          <form onSubmit={add}>
            <div className="form-field">
              <label htmlFor="person-name">Ton prénom</label>
              <input
                id="person-name"
                className="search name-big"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="given-name"
                autoFocus
                maxLength={30}
              />
            </div>
            <button className="btn btn-primary btn-block btn-big" type="submit" disabled={!name.trim()}>
              C’est parti 💪
            </button>
            {list.length > 0 && (
              <button type="button" className="link-btn auth-link" onClick={() => setAdding(false)}>
                ← Retour
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
