import { useState, type ReactNode } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { bmi, bmiCategory, weightDelta } from '../../domain/body';
import { formatKg, formatSigned } from '../../domain/format';
import type { BodyCheck, Profile } from '../../domain/types';
import { useFeedback } from '../../ui/feedback';
import { Sheet } from '../../ui/Sheet';
import { AccountSection } from '../auth/AccountSection';
import { BackupSection } from '../backup/BackupSection';
import { InstallSection } from '../install/InstallSection';
import { people } from '../../data/people';
import { switchPerson } from '../people/PersonGate';
import { PhotoChoice } from '../../ui/PhotoChoice';
import {
  CUSTOM_PHOTO,
  getCustomBackground,
  personPhoto,
  photoForName,
  setCustomBackground,
} from '../../ui/splashPhotos';
import { PHOTO_CHANGED } from '../../ui/AppBackground';
import { SettingsSection } from '../settings/SettingsSection';
import { versionLabel } from '../../version';
import { UserIcon } from '../../ui/icons';
import { PageHeader } from '../../ui/PageHeader';
import { Avatar, photoToAvatar, photoToBackground } from '../../ui/Avatar';
import { locale, t } from '../../i18n';

/** Le prénom du profil sert aussi dans la liste « Qui s'entraîne ? ». */
function renameActive(firstName: string) {
  const id = people.activeId();
  if (id) people.rename(id, firstName);
}

const dateFormat = {
  format: (date: number) =>
    new Date(date).toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' }),
};

function parseNumber(text: string): number {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function ProfileScreen() {
  const { profile: repo } = useRepositories();
  const { confirm } = useFeedback();
  const profile = useSubscribable(() => repo.watch(), []);
  const checks = useSubscribable(() => repo.watchChecks(), []);
  const [editing, setEditing] = useState(false);
  const [weighing, setWeighing] = useState(false);
  const avatar = useAvatar();

  if (profile === undefined || !checks) return null;

  if (profile === null) {
    return (
      <div className="screen">
        <PageHeader
          icon={<UserIcon />}
          title={t('Mon profil')}
          subtitle={t('Quelques infos pour suivre ton évolution. Elles restent sur ton téléphone.')}
        />
        <ProfileForm
          onSave={async (data, weightKg) => {
            await repo.save(data);
            renameActive(data.firstName);
            if (weightKg > 0) await repo.addCheck({ date: Date.now(), weightKg });
          }}
        />
        <PersonSection avatar={avatar} />
        <BackupSection />
        <SettingsSection />
        <AppVersion />
      </div>
    );
  }

  const latest = checks[0];
  const first = checks[checks.length - 1];
  const currentBmi = latest ? bmi(latest.weightKg, profile.heightCm) : null;
  const totalDelta = latest && first && latest !== first ? weightDelta(latest.weightKg, first.weightKg) : null;

  const removeCheck = async (check: BodyCheck) => {
    const ok = await confirm({
      title: t('Supprimer cette pesée ?'),
      message: t('{kg} kg le {date}', { kg: formatKg(check.weightKg), date: dateFormat.format(check.date) }),
      confirmLabel: t('Supprimer'),
      danger: true,
    });
    if (ok) await repo.deleteCheck(check.id);
  };

  return (
    <div className="screen">
      <header className="page-header" style={{ marginTop: 12 }}>
        <PhotoPicker className="avatar-btn" onFile={avatar.onFile} label={t('Changer ma photo de profil')}>
          <Avatar name={profile.firstName} photo={avatar.photo} />
          <span className="avatar-camera" aria-hidden="true">
            📷
          </span>
        </PhotoPicker>
        <div className="grow">
          <h1 className="page-title">{profile.firstName || t('Mon profil')}</h1>
          <p className="page-subtitle">{t('Membre Work & Discipline')}</p>
        </div>
        <button className="icon-btn edit-btn" onClick={() => setEditing(true)} aria-label={t('Modifier le profil')}>
          ✏️
        </button>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">{t('Poids actuel')}</div>
          <div className="stat-value">{latest ? `${formatKg(latest.weightKg)} kg` : '—'}</div>
          <div className="stat-hint">{latest ? dateFormat.format(latest.date) : t('Aucune pesée')}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('Taille')}</div>
          <div className="stat-value">{profile.heightCm} cm</div>
          <div className="stat-hint">&nbsp;</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('IMC')}</div>
          <div className="stat-value">{currentBmi !== null ? formatKg(currentBmi) : '—'}</div>
          <div className="stat-hint">{currentBmi !== null ? bmiCategory(currentBmi) : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-label">{t('Évolution')}</div>
          <div
            className={`stat-value${totalDelta && totalDelta > 0 ? ' up' : totalDelta && totalDelta < 0 ? ' down' : ''}`}
          >
            {totalDelta !== null ? `${formatSigned(totalDelta)} kg` : '—'}
          </div>
          <div className="stat-hint">
            {first && totalDelta !== null ? t('depuis le {date}', { date: dateFormat.format(first.date) }) : ''}
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 16 }} onClick={() => setWeighing(true)}>
        ⚖️ {t('Nouvelle pesée')}
      </button>

      {checks.length > 0 && (
        <>
          <h2 className="section-title">{t('Historique du poids')}</h2>
          <div className="card" style={{ padding: '4px 16px' }}>
            {checks.map((c, i) => {
              const previous = checks[i + 1];
              const delta = previous ? weightDelta(c.weightKg, previous.weightKg) : null;
              return (
                <button key={c.id} className="list-item" onClick={() => removeCheck(c)}>
                  <div className="grow">
                    <div className="title">{formatKg(c.weightKg)} kg</div>
                    <div className="subtitle">{dateFormat.format(c.date)}</div>
                  </div>
                  {delta !== null && (
                    <span className={`delta${delta > 0 ? ' up' : delta < 0 ? ' down' : ''}`}>
                      {formatSigned(delta)} kg
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="muted small">{t('Touche une pesée pour la supprimer.')}</p>
        </>
      )}

      <PersonSection avatar={avatar} />
      <BackupSection />

      <InstallSection />
      <AccountSection />
      <SettingsSection />
      <AppVersion />

      {editing && (
        <Sheet onClose={() => setEditing(false)} title={t('Modifier le profil')}>
          <ProfileForm
            initial={profile}
            onSave={async (data) => {
              setEditing(false);
              await repo.save(data);
              renameActive(data.firstName);
            }}
          />
        </Sheet>
      )}

      {weighing && (
        <WeightSheet
          initial={latest?.weightKg ?? 70}
          onClose={() => setWeighing(false)}
          onSave={async (weightKg) => {
            setWeighing(false);
            await repo.addCheck({ date: Date.now(), weightKg });
          }}
        />
      )}
    </div>
  );
}

function ProfileForm({
  initial,
  onSave,
}: {
  initial?: Profile;
  onSave: (data: Omit<Profile, 'id' | 'updatedAt'>, weightKg: number) => void;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? people.active()?.name ?? '');
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState('');
  const heightCm = Math.round(parseNumber(height));
  const valid = firstName.trim() !== '' && heightCm >= 100 && heightCm <= 250 && (initial || parseNumber(weight) > 0);

  return (
    <div style={{ marginTop: 16 }}>
      <div className="form-field">
        <label htmlFor="p-name">{t('Prénom')}</label>
        <input id="p-name" className="search" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="p-height">{t('Taille (cm)')}</label>
        <input
          id="p-height"
          className="search"
          inputMode="numeric"
          placeholder={t('ex. {value}', { value: 178 })}
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </div>
      {!initial && (
        <div className="form-field">
          <label htmlFor="p-weight">{t('Poids actuel (kg)')}</label>
          <input
            id="p-weight"
            className="search"
            inputMode="decimal"
            placeholder={t('ex. {value}', { value: formatKg(72.5) })}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        </div>
      )}
      <button
        className="btn btn-primary btn-block"
        disabled={!valid}
        onClick={() =>
          onSave(
            {
              firstName: firstName.trim(),
              heightCm,
              checkFrequencyDays: initial?.checkFrequencyDays ?? 7,
              ...(initial?.birthDate ? { birthDate: initial.birthDate } : {}),
              ...(initial?.sex ? { sex: initial.sex } : {}),
              ...(initial?.goal ? { goal: initial.goal } : {}),
            },
            parseNumber(weight),
          )
        }
      >
        {t('Enregistrer')}
      </button>
    </div>
  );
}

function WeightSheet({
  initial,
  onClose,
  onSave,
}: {
  initial: number;
  onClose: () => void;
  onSave: (kg: number) => void;
}) {
  const [weight, setWeight] = useState(formatKg(initial));
  const bump = (delta: number) => setWeight(formatKg(Math.max(0, Math.round((parseNumber(weight) + delta) * 10) / 10)));
  return (
    <Sheet onClose={onClose} title={t('Nouvelle pesée')}>
      <div className="stepper">
        <div className="stepper-label">{t('Poids (kg)')}</div>
        <div className="stepper-row">
          <button className="stepper-btn" onClick={() => bump(-0.1)} aria-label={t('Moins 100 grammes')}>
            −
          </button>
          <input
            className="stepper-input"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label={t('Poids en kg')}
          />
          <button className="stepper-btn" onClick={() => bump(0.1)} aria-label={t('Plus 100 grammes')}>
            +
          </button>
        </div>
        <div className="chips-row">
          {[-1, -0.5, 0.5, 1].map((d) => (
            <button key={d} className="chip" onClick={() => bump(d)}>
              {d > 0 ? '+' : '−'}
              {formatKg(Math.abs(d))} kg
            </button>
          ))}
        </div>
      </div>
      <button
        className="btn btn-primary btn-block btn-big"
        disabled={parseNumber(weight) <= 0}
        onClick={() => onSave(parseNumber(weight))}
      >
        {t('Enregistrer')}
      </button>
    </Sheet>
  );
}

type AvatarState = ReturnType<typeof useAvatar>;

/** Photo de profil de la personne : choisie dans la galerie ou prise avec l'appareil photo. */
function useAvatar() {
  const { toast } = useFeedback();
  const [photo, setPhoto] = useState(people.active()?.avatar);

  const save = (value: string | undefined) => {
    const id = people.activeId();
    if (!id) return;
    if (people.setAvatar(id, value)) setPhoto(value);
    else toast(t('Impossible d’enregistrer la photo sur ce téléphone.'));
  };

  const onFile = async (file: File) => {
    try {
      save(await photoToAvatar(file));
    } catch {
      toast(t('Cette photo n’a pas pu être ouverte.'));
    }
  };

  return { photo, onFile, remove: () => save(undefined) };
}

/**
 * Zone qui ouvre le choix d'une photo (« Photothèque » ou « Prendre une photo » sur iPhone).
 * Un <label> autour du champ : la façon la plus fiable de l'ouvrir sur iPhone.
 */
function PhotoPicker({
  onFile,
  className,
  label,
  children,
}: {
  onFile: (file: File) => void;
  className: string;
  label?: string;
  children: ReactNode;
}) {
  return (
    <label className={className} aria-label={label}>
      <input
        type="file"
        accept="image/*"
        className="visually-hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onFile(file);
        }}
      />
      {children}
    </label>
  );
}

/** Photo de profil, photo d'accueil et changement de personne (plusieurs personnes peuvent utiliser l'appli sur le même téléphone). */
function PersonSection({ avatar }: { avatar: AvatarState }) {
  const { toast, confirm } = useFeedback();
  const [photo, setPhoto] = useState(personPhoto());
  const choose = (file: string) => {
    const id = people.activeId();
    if (id) people.setPhoto(id, file);
    setPhoto(file);
    window.dispatchEvent(new Event(PHOTO_CHANGED));
  };
  return (
    <>
      <h2 className="section-title">{t('Ma photo')}</h2>
      <div className="card avatar-card">
        <Avatar name={people.active()?.name ?? ''} photo={avatar.photo} />
        <div className="grow stack">
          <PhotoPicker className="btn btn-block btn-small" onFile={avatar.onFile}>
            📷 {avatar.photo ? t('Changer ma photo') : t('Mettre ma photo')}
          </PhotoPicker>
          {avatar.photo && (
            <button className="link-btn" onClick={avatar.remove}>
              {t('Retirer ma photo')}
            </button>
          )}
        </div>
      </div>

      <h2 className="section-title">{t('Photo de fond')}</h2>
      <div className="card">
        <p className="muted small" style={{ marginTop: 0 }}>
          {t('Elle s’affiche sur l’écran de bienvenue et derrière toute l’appli. Choisis-en une ou mets la tienne.')}
        </p>
        <PhotoChoice
          value={photo}
          onChange={choose}
          onCustomFile={async (file) => {
            try {
              const image = await photoToBackground(file);
              if (!setCustomBackground(image)) {
                toast(t('Pas assez de place sur le téléphone pour cette photo.'));
                return;
              }
              choose(CUSTOM_PHOTO);
              toast(t('Photo de fond enregistrée ✅'));
            } catch {
              toast(t('Cette photo n’a pas pu être ouverte.'));
            }
          }}
        />
        {getCustomBackground() && (
          <button
            className="link-btn danger-link"
            style={{ marginTop: 12 }}
            onClick={async () => {
              const ok = await confirm({
                title: t('Supprimer ta photo de fond ?'),
                message: t('Elle sera retirée de ce téléphone. Tu pourras en remettre une quand tu veux.'),
                confirmLabel: t('Supprimer'),
                danger: true,
              });
              if (!ok) return;
              setCustomBackground(null);
              // Retour à la photo proposée d'après le prénom.
              choose(photo === CUSTOM_PHOTO ? photoForName(people.active()?.name ?? '') : photo);
              toast(t('Photo de fond supprimée'));
            }}
          >
            🗑️ {t('Supprimer ma photo de fond')}
          </button>
        )}
      </div>

      <h2 className="section-title">{t('Personne')}</h2>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>
          {t('Plusieurs personnes peuvent utiliser l’appli sur ce téléphone, chacune avec ses propres séances.')}
        </p>
        <button className="btn btn-block btn-small" onClick={() => switchPerson()}>
          👥 {t('Changer de personne')}
        </button>
      </div>
    </>
  );
}

/** Numéro de version tout en bas du profil (il change à chaque mise à jour de l'appli). */
function AppVersion() {
  return <p className="app-version">{versionLabel(t('Version'))}</p>;
}
