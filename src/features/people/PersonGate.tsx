import Dexie from 'dexie';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { db } from '../../data';
import { hasPersonalData } from '../../data/backup';
import { dbNameFor, people, type Person } from '../../data/people';
import { useFeedback } from '../../ui/feedback';
import { initials } from '../../ui/PageHeader';
import { PhotoChoice } from '../../ui/PhotoChoice';
import { DEFAULT_PHOTO, photoForName, splashPhotoUrl } from '../../ui/splashPhotos';

// Personne choisie pour cette ouverture de l'appli (oublié quand l'appli est fermée).
const CHOSEN_KEY = 'wd-chosen';

function chosenThisSession(): string | null {
  try {
    return sessionStorage.getItem(CHOSEN_KEY);
  } catch {
    return null;
  }
}

function rememberChoice(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CHOSEN_KEY, id);
    else sessionStorage.removeItem(CHOSEN_KEY);
  } catch {
    // stockage indisponible : on redemandera
  }
}

/** Redémarre l'appli (adresse sans « # » : rechargement complet, sur l'onglet Programme). */
function restart() {
  window.location.href = window.location.pathname + window.location.search;
}

/** Revient à l'écran « Qui s'entraîne ? ». */
export function switchPerson() {
  rememberChoice(null);
  restart();
}

/**
 * À chaque ouverture : « Qui s'entraîne ? », puis l'écran « Bienvenue <prénom> » avec le bouton GO,
 * puis l'appli avec les données de la personne choisie.
 */
export function PersonGate({ children, welcome }: { children: ReactNode; welcome: ReactNode }) {
  const [chosen, setChosen] = useState(() => {
    const id = chosenThisSession();
    return !!id && id === people.activeId() && !!people.active();
  });
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
  if (chosen) {
    return (
      <>
        {children}
        {welcome}
      </>
    );
  }

  const choose = (person: Person) => {
    people.select(person.id);
    rememberChoice(person.id);
    // La base déjà ouverte est celle de cette personne : pas besoin de redémarrer.
    if (dbNameFor(person.id) === db.name) setChosen(true);
    else restart();
  };

  return <PersonPicker onChoose={choose} />;
}

function PersonPicker({ onChoose }: { onChoose: (p: Person) => void }) {
  const { confirm } = useFeedback();
  const [list, setList] = useState(people.list());
  const [adding, setAdding] = useState(list.length === 0);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [photo, setPhoto] = useState(DEFAULT_PHOTO);
  // Tant que la personne n'a pas touché une photo, on propose celle qui correspond à son prénom.
  const [photoTouched, setPhotoTouched] = useState(false);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onChoose(people.add(name, photo));
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
                onChange={(e) => {
                  setName(e.target.value);
                  if (!photoTouched) setPhoto(photoForName(e.target.value));
                }}
                // Pas d'autoFocus : sur iPhone, un champ activé sans toucher l'écran peut empêcher le clavier de s'ouvrir.
                onTouchEnd={(e) => e.currentTarget.focus()}
                type="text"
                autoComplete="given-name"
                maxLength={30}
              />
            </div>
            <div className="form-field">
              <label>Ta photo d’accueil</label>
              <PhotoChoice
                value={photo}
                onChange={(file) => {
                  setPhoto(file);
                  setPhotoTouched(true);
                }}
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
