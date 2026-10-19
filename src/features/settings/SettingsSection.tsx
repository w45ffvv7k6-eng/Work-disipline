import { useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock, formatKg } from '../../domain/format';
import type { Settings } from '../../domain/types';
import { ALARM_SOUNDS, playAlarm, unlockAudio } from '../../ui/alarm';
import { haptic } from '../../ui/feedback';
import { THEMES } from '../../ui/theme';
import { RestPickerSheet } from '../timer/RestPickerSheet';

const WEIGHT_STEPS = [1, 1.25, 2.5, 5];

/** Réglages de l'appli (affichés dans l'onglet Profil). */
export function SettingsSection() {
  const { settings: repo } = useRepositories();
  const settings = useSubscribable(() => repo.watch(), []);
  const [pickingRest, setPickingRest] = useState(false);
  if (!settings) return null;

  const toggle = (key: keyof Pick<Settings, 'sound' | 'vibration' | 'keepAwake'>) =>
    repo.update({ [key]: !settings[key] });

  return (
    <>
      <h2 className="section-title">Couleur de l’appli</h2>
      <div className="card">
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-swatch${settings.theme === t.id ? ' selected' : ''}`}
              onClick={() => {
                haptic();
                void repo.update({ theme: t.id });
              }}
              aria-pressed={settings.theme === t.id}
            >
              <span className="swatch" style={{ background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})` }}>
                {settings.theme === t.id && '✓'}
              </span>
              <span className="swatch-name">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">Minuteur de repos</h2>
      <div className="card stack">
        <button className="toggle-row" onClick={() => setPickingRest(true)}>
          <span>
            Repos par défaut
            <div className="muted small">Si l’exercice ou le modèle n’en précise pas</div>
          </span>
          <span className="value-pill">{formatClock(settings.defaultRestSec * 1000)}</span>
        </button>
        <ToggleRow
          label="Son à la fin du repos"
          hint="Coupé si l’iPhone est en mode silencieux"
          on={settings.sound}
          onClick={() => toggle('sound')}
        />
        {settings.sound && (
          <div>
            <div className="mini-label" style={{ textAlign: 'left', marginBottom: 8 }}>
              Son de fin de repos (touche pour écouter)
            </div>
            <div className="sound-grid">
              {ALARM_SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  className={`sound-choice${settings.alarmSound === sound.id ? ' selected' : ''}`}
                  onClick={() => {
                    unlockAudio();
                    playAlarm(sound.id);
                    void repo.update({ alarmSound: sound.id });
                  }}
                  aria-pressed={settings.alarmSound === sound.id}
                >
                  <span className="sound-emoji">{sound.emoji}</span>
                  {sound.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <ToggleRow
          label="Vibration à la fin du repos"
          hint="Android uniquement (l’iPhone ne le permet pas)"
          on={settings.vibration}
          onClick={() => toggle('vibration')}
        />
        <button
          className="btn btn-block btn-small"
          onClick={() => {
            unlockAudio();
            if (settings.sound) playAlarm(settings.alarmSound);
            if (settings.vibration) haptic([300, 150, 300]);
          }}
        >
          Tester l’alerte
        </button>
      </div>

      <h2 className="section-title">Séance</h2>
      <div className="card stack">
        <ToggleRow
          label="Garder l’écran allumé"
          hint="Pendant une séance en cours, pour voir le minuteur"
          on={settings.keepAwake}
          onClick={() => toggle('keepAwake')}
        />
        <div>
          <div className="toggle-row" style={{ minHeight: 0, paddingBottom: 8 }}>
            Pas des boutons − / + (kg)
          </div>
          <div className="segmented">
            {WEIGHT_STEPS.map((step) => (
              <button
                key={step}
                className={settings.weightStepKg === step ? 'active' : ''}
                onClick={() => repo.update({ weightStepKg: step })}
              >
                {formatKg(step)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pickingRest && (
        <RestPickerSheet
          title="Repos par défaut"
          current={settings.defaultRestSec}
          onClose={() => setPickingRest(false)}
          onPick={async (sec) => {
            setPickingRest(false);
            await repo.update({ defaultRestSec: sec });
          }}
        />
      )}
    </>
  );
}

function ToggleRow({ label, hint, on, onClick }: { label: string; hint?: string; on: boolean; onClick: () => void }) {
  return (
    <button className="toggle-row" onClick={onClick} role="switch" aria-checked={on}>
      <span>
        {label}
        {hint && <div className="muted small">{hint}</div>}
      </span>
      <span className={`switch switch-accent${on ? ' on' : ''}`} />
    </button>
  );
}
