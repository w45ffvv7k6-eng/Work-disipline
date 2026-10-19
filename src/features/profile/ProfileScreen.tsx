import { useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { bmi, bmiCategory, weightDelta } from '../../domain/body';
import { formatKg } from '../../domain/format';
import type { BodyCheck, Profile } from '../../domain/types';
import { useFeedback } from '../../ui/feedback';
import { Sheet } from '../../ui/Sheet';
import { SettingsSection } from '../settings/SettingsSection';
import { UserIcon } from '../../ui/icons';
import { initials, PageHeader } from '../../ui/PageHeader';

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

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

  if (profile === undefined || !checks) return null;

  if (profile === null) {
    return (
      <div className="screen">
        <PageHeader
          icon={<UserIcon />}
          title="Mon profil"
          subtitle="Quelques infos pour suivre ton évolution. Elles restent sur ton téléphone."
        />
        <ProfileForm
          onSave={async (data, weightKg) => {
            await repo.save(data);
            if (weightKg > 0) await repo.addCheck({ date: Date.now(), weightKg });
          }}
        />
      </div>
    );
  }

  const latest = checks[0];
  const first = checks[checks.length - 1];
  const currentBmi = latest ? bmi(latest.weightKg, profile.heightCm) : null;
  const totalDelta = latest && first && latest !== first ? weightDelta(latest.weightKg, first.weightKg) : null;

  const removeCheck = async (check: BodyCheck) => {
    const ok = await confirm({
      title: 'Supprimer cette pesée ?',
      message: `${formatKg(check.weightKg)} kg le ${dateFormat.format(check.date)}`,
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (ok) await repo.deleteCheck(check.id);
  };

  return (
    <div className="screen">
      <header className="page-header" style={{ marginTop: 12 }}>
        <div className="avatar" aria-hidden="true">
          {initials(profile.firstName || '?')}
        </div>
        <div className="grow">
          <h1 className="page-title">{profile.firstName || 'Mon profil'}</h1>
          <p className="page-subtitle">Membre Work &amp; Discipline</p>
        </div>
        <button className="icon-btn edit-btn" onClick={() => setEditing(true)} aria-label="Modifier le profil">
          ✏️
        </button>
      </header>

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Poids actuel</div>
          <div className="stat-value">{latest ? `${formatKg(latest.weightKg)} kg` : '—'}</div>
          <div className="stat-hint">{latest ? dateFormat.format(latest.date) : 'Aucune pesée'}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Taille</div>
          <div className="stat-value">{profile.heightCm} cm</div>
          <div className="stat-hint">&nbsp;</div>
        </div>
        <div className="stat">
          <div className="stat-label">IMC</div>
          <div className="stat-value">{currentBmi !== null ? formatKg(currentBmi) : '—'}</div>
          <div className="stat-hint">{currentBmi !== null ? bmiCategory(currentBmi) : ''}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Évolution</div>
          <div
            className={`stat-value${totalDelta && totalDelta > 0 ? ' up' : totalDelta && totalDelta < 0 ? ' down' : ''}`}
          >
            {totalDelta !== null ? `${totalDelta > 0 ? '+' : ''}${formatKg(totalDelta)} kg` : '—'}
          </div>
          <div className="stat-hint">
            {first && totalDelta !== null ? `depuis le ${dateFormat.format(first.date)}` : ''}
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-block btn-big" style={{ marginTop: 16 }} onClick={() => setWeighing(true)}>
        ⚖️ Nouvelle pesée
      </button>

      {checks.length > 0 && (
        <>
          <h2 className="section-title">Historique du poids</h2>
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
                      {delta > 0 ? '+' : ''}
                      {formatKg(delta)} kg
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="muted small">Touche une pesée pour la supprimer.</p>
        </>
      )}

      <SettingsSection />

      {editing && (
        <Sheet onClose={() => setEditing(false)} title="Modifier le profil">
          <ProfileForm
            initial={profile}
            onSave={async (data) => {
              setEditing(false);
              await repo.save(data);
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
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState('');
  const heightCm = Math.round(parseNumber(height));
  const valid = firstName.trim() !== '' && heightCm >= 100 && heightCm <= 250 && (initial || parseNumber(weight) > 0);

  return (
    <div style={{ marginTop: 16 }}>
      <div className="form-field">
        <label htmlFor="p-name">Prénom</label>
        <input id="p-name" className="search" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div className="form-field">
        <label htmlFor="p-height">Taille (cm)</label>
        <input
          id="p-height"
          className="search"
          inputMode="numeric"
          placeholder="ex. 178"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
        />
      </div>
      {!initial && (
        <div className="form-field">
          <label htmlFor="p-weight">Poids actuel (kg)</label>
          <input
            id="p-weight"
            className="search"
            inputMode="decimal"
            placeholder="ex. 72,5"
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
        Enregistrer
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
    <Sheet onClose={onClose} title="Nouvelle pesée">
      <div className="stepper">
        <div className="stepper-label">Poids (kg)</div>
        <div className="stepper-row">
          <button className="stepper-btn" onClick={() => bump(-0.1)} aria-label="Moins 100 grammes">
            −
          </button>
          <input
            className="stepper-input"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onFocus={(e) => e.target.select()}
            aria-label="Poids en kg"
          />
          <button className="stepper-btn" onClick={() => bump(0.1)} aria-label="Plus 100 grammes">
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
        Enregistrer
      </button>
    </Sheet>
  );
}
