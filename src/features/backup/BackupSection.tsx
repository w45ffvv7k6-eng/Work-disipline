import { useState } from 'react';
import { db } from '../../data';
import { exportAll, importAll, isBackupFile, type BackupFile } from '../../data/backup';
import { people } from '../../data/people';
import { formatLongDate } from '../../domain/format';
import { t, tn } from '../../i18n';
import { useFeedback } from '../../ui/feedback';
import { getCustomBackground, setCustomBackground } from '../../ui/splashPhotos';

/** Au-delà, on rappelle de refaire une sauvegarde. */
const REMIND_AFTER_DAYS = 14;
const DAY_MS = 86_400_000;

const storageKey = () => `wd-backup-${people.activeId() ?? 'default'}`;

function lastBackupAt(): number | null {
  try {
    const value = Number(localStorage.getItem(storageKey()));
    return value > 0 ? value : null;
  } catch {
    return null;
  }
}

function rememberBackup(at: number) {
  try {
    localStorage.setItem(storageKey(), String(at));
  } catch {
    // stockage indisponible : seul le rappel est perdu
  }
}

/** "work-discipline-rafael-2026-10-21.json" */
function fileName(name: string | undefined, date: Date): string {
  const slug = (name || 'sauvegarde')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return `work-discipline-${slug || 'sauvegarde'}-${day}.json`;
}

/** Envoie le fichier : menu de partage sur téléphone (Enregistrer dans Fichiers, e-mail…), sinon téléchargement. */
async function deliver(file: File): Promise<boolean> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Work & Discipline' });
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') return false;
      // Partage refusé par le navigateur : on télécharge à la place.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** Sauvegarde de toutes les données de la personne dans un fichier, et restauration (onglet Profil). */
export function BackupSection() {
  const { toast, confirm } = useFeedback();
  const [last, setLast] = useState(lastBackupAt);
  const [busy, setBusy] = useState(false);
  const daysSince = last ? Math.floor((Date.now() - last) / DAY_MS) : null;

  const save = async () => {
    setBusy(true);
    try {
      const person = people.active();
      const backup: BackupFile = {
        ...(await exportAll(db)),
        person: {
          name: person?.name,
          photo: person?.photo,
          avatar: person?.avatar,
          lang: person?.lang,
          background: getCustomBackground() ?? undefined,
        },
      };
      const now = new Date();
      const file = new File([JSON.stringify(backup)], fileName(person?.name, now), { type: 'application/json' });
      if (await deliver(file)) {
        rememberBackup(now.getTime());
        setLast(now.getTime());
        toast(t('Sauvegarde créée ✅ Garde bien le fichier.'));
      }
    } catch {
      toast(t('La sauvegarde n’a pas pu être créée.'));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (file: File) => {
    let backup: unknown;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      backup = null;
    }
    if (!isBackupFile(backup)) {
      toast(t('Ce fichier n’est pas une sauvegarde Work & Discipline.'));
      return;
    }
    const sessions = backup.data.workouts?.length ?? 0;
    const ok = await confirm({
      title: t('Restaurer cette sauvegarde ?'),
      message: `${t('Sauvegarde du {date}', { date: formatLongDate(backup.exportedAt) })} · ${tn(
        sessions,
        '{n} séance',
        '{n} séances',
      )}. ${t('Les données actuelles de ce profil seront remplacées.')}`,
      confirmLabel: t('Restaurer'),
      danger: true,
    });
    if (!ok) return;
    try {
      await importAll(db, backup);
      const id = people.activeId();
      if (id && backup.person) {
        if (backup.person.avatar) people.setAvatar(id, backup.person.avatar);
        if (backup.person.photo) people.setPhoto(id, backup.person.photo);
        if (backup.person.lang) people.setLang(id, backup.person.lang);
        if (backup.person.background) setCustomBackground(backup.person.background, id);
      }
      toast(t('Sauvegarde restaurée ✅'));
      // Redémarrage pour tout réafficher (programme, couleurs, langue…).
      window.setTimeout(() => window.location.reload(), 900);
    } catch {
      toast(t('La restauration a échoué : tes données n’ont pas été modifiées.'));
    }
  };

  return (
    <>
      <h2 className="section-title">{t('Sauvegarde')}</h2>
      <div className="card stack">
        <p className="muted small" style={{ margin: 0 }}>
          {t(
            'Tes séances sont enregistrées uniquement sur ce téléphone. Fais une sauvegarde de temps en temps et garde le fichier dans Fichiers, iCloud Drive ou par e-mail : tu pourras tout récupérer sur un nouveau téléphone.',
          )}
        </p>
        <div className={`backup-status${daysSince === null || daysSince >= REMIND_AFTER_DAYS ? ' warn' : ''}`}>
          {last === null
            ? `⚠️ ${t('Aucune sauvegarde pour l’instant')}`
            : daysSince === 0
              ? `✅ ${t('Dernière sauvegarde : aujourd’hui')}`
              : `${daysSince! >= REMIND_AFTER_DAYS ? '⚠️' : '✅'} ${tn(
                  daysSince!,
                  'Dernière sauvegarde : il y a {n} jour',
                  'Dernière sauvegarde : il y a {n} jours',
                )}`}
        </div>
        <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
          💾 {t('Sauvegarder mes données')}
        </button>
        <label className="btn btn-block btn-small">
          <input
            type="file"
            accept=".json,application/json"
            className="visually-hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void restore(file);
            }}
          />
          📂 {t('Restaurer une sauvegarde')}
        </label>
      </div>
    </>
  );
}
