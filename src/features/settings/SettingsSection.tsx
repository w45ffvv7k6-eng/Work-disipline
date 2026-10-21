import { useState } from 'react';
import { useRepositories, useSubscribable } from '../../data';
import { formatClock, formatKg } from '../../domain/format';
import type { Settings } from '../../domain/types';
import { ALARM_SOUNDS, playAlarm, unlockAudio } from '../../ui/alarm';
import { haptic } from '../../ui/feedback';
import { BACKGROUNDS, backgroundFor, THEMES } from '../../ui/theme';
import { RestPickerSheet } from '../timer/RestPickerSheet';
import { k, t } from '../../i18n';
import { LANGUAGES, useLanguage } from '../../i18n/react';

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
      <LanguageSection />

      <h2 className="section-title">{t('Couleur principale')}</h2>
      <div className="card">
        <div className="theme-grid">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              className={`theme-swatch${settings.theme === theme.id ? ' selected' : ''}`}
              onClick={() => {
                haptic();
                void repo.update({ theme: theme.id });
              }}
              aria-pressed={settings.theme === theme.id}
            >
              <span
                className="swatch"
                style={{ background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})` }}
              >
                {settings.theme === theme.id && '✓'}
              </span>
              <span className="swatch-name">{t(theme.name)}</span>
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">{t('Couleur du fond')}</h2>
      <div className="card">
        <div className="bg-grid">
          {[
            { id: 'assorti', name: k('Assorti'), base: backgroundFor(settings.theme, 'assorti').base },
            ...BACKGROUNDS,
          ].map((b) => {
            const selected = (settings.background ?? 'assorti') === b.id;
            return (
              <button
                key={b.id}
                className={`bg-swatch${selected ? ' selected' : ''}`}
                onClick={() => {
                  haptic();
                  void repo.update({ background: b.id });
                }}
                aria-pressed={selected}
              >
                <span className="bg-sample" style={{ background: b.base }}>
                  <span className="bg-dot" />
                  {b.id === 'assorti' && <span className="bg-auto">A</span>}
                </span>
                <span className="swatch-name">{t(b.name)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <h2 className="section-title">{t('Minuteur de repos')}</h2>
      <div className="card stack">
        <button className="toggle-row" onClick={() => setPickingRest(true)}>
          <span>
            {t('Repos par défaut')}
            <div className="muted small">{t('Si l’exercice ou le modèle n’en précise pas')}</div>
          </span>
          <span className="value-pill">{formatClock(settings.defaultRestSec * 1000)}</span>
        </button>
        <ToggleRow
          label={t('Son à la fin du repos')}
          hint={t('Le volume du téléphone compte aussi : monte-le avec les boutons sur le côté.')}
          on={settings.sound}
          onClick={() => toggle('sound')}
        />
        {settings.sound && (
          <div>
            <div className="mini-label" style={{ textAlign: 'start', marginBottom: 8 }}>
              {t('Son de fin de repos (touche pour écouter)')}
            </div>
            <div className="sound-grid">
              {ALARM_SOUNDS.map((sound) => (
                <button
                  key={sound.id}
                  className={`sound-choice${settings.alarmSound === sound.id ? ' selected' : ''}`}
                  onClick={() => {
                    unlockAudio();
                    playAlarm(sound.id, settings.alarmVolume);
                    void repo.update({ alarmSound: sound.id });
                  }}
                  aria-pressed={settings.alarmSound === sound.id}
                >
                  <span className="sound-emoji">{sound.emoji}</span>
                  {t(sound.name)}
                </button>
              ))}
            </div>
            <VolumeSlider
              value={settings.alarmVolume}
              onChange={(volume) => void repo.update({ alarmVolume: volume })}
              onPreview={(volume) => {
                unlockAudio();
                playAlarm(settings.alarmSound, volume);
              }}
            />
          </div>
        )}
        <ToggleRow
          label={t('Vibration à la fin du repos')}
          hint={t('Android uniquement (l’iPhone ne le permet pas)')}
          on={settings.vibration}
          onClick={() => toggle('vibration')}
        />
        <button
          className="btn btn-block btn-small"
          onClick={() => {
            unlockAudio();
            if (settings.sound) playAlarm(settings.alarmSound, settings.alarmVolume);
            if (settings.vibration) haptic([300, 150, 300]);
          }}
        >
          {t('Tester l’alerte')}
        </button>
      </div>

      <h2 className="section-title">{t('Séance')}</h2>
      <div className="card stack">
        <ToggleRow
          label={t('Garder l’écran allumé')}
          hint={t('Pendant une séance en cours, pour voir le minuteur')}
          on={settings.keepAwake}
          onClick={() => toggle('keepAwake')}
        />
        <div>
          <div className="toggle-row" style={{ minHeight: 0, paddingBottom: 8 }}>
            {t('Pas des boutons − / + (kg)')}
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
          title={t('Repos par défaut')}
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

/** Choix de la langue de l'appli (enregistré pour la personne). */
export function LanguageSection() {
  const { lang, change } = useLanguage();
  return (
    <>
      <h2 className="section-title">{t('Langue')}</h2>
      <div className="card">
        <div className="lang-grid">
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              className={`lang-choice${lang === l.id ? ' selected' : ''}`}
              onClick={() => {
                haptic();
                change(l.id);
              }}
              aria-pressed={lang === l.id}
              lang={l.id}
            >
              <span className="lang-flag" aria-hidden="true">
                {l.flag}
              </span>
              {l.name}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Volume du son de fin de repos (10 à 100 %). Le son est rejoué quand on lâche le curseur. */
function VolumeSlider({
  value,
  onChange,
  onPreview,
}: {
  value: number;
  onChange: (volume: number) => void;
  onPreview: (volume: number) => void;
}) {
  const [volume, setVolume] = useState(value);
  const commit = () => {
    onChange(volume);
    onPreview(volume);
  };
  const bump = (delta: number) => {
    const next = Math.min(100, Math.max(10, volume + delta));
    setVolume(next);
    onChange(next);
    onPreview(next);
  };
  return (
    <div className="volume">
      <div className="mini-label" style={{ textAlign: 'start' }}>
        {t('Volume du son')} · <b>{volume} %</b>
      </div>
      <div className="volume-row">
        <button
          className="volume-btn"
          onClick={() => bump(-10)}
          disabled={volume <= 10}
          aria-label={t('Baisser le son')}
        >
          🔈
        </button>
        <input
          type="range"
          min={10}
          max={100}
          step={10}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          aria-label={t('Volume du son')}
          style={{ ['--fill' as string]: `${((volume - 10) / 90) * 100}%` }}
        />
        <button
          className="volume-btn"
          onClick={() => bump(10)}
          disabled={volume >= 100}
          aria-label={t('Monter le son')}
        >
          🔊
        </button>
      </div>
    </div>
  );
}
