import { useState, type FormEvent } from 'react';
import { frenchAuthError } from '../../data/sync/supabaseBackend';
import { DumbbellIcon } from '../../ui/icons';
import { splashPhotoUrl } from '../../ui/splashPhotos';
import { useAuth } from './AuthProvider';

type Mode = 'signin' | 'signup' | 'forgot';

/** Écran de connexion / création de compte. */
export function AuthScreen() {
  const auth = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (mode === 'signup' && password !== confirm) return setError('Les deux mots de passe ne sont pas identiques.');
    setBusy(true);
    try {
      if (mode === 'signin') {
        await auth.signIn(email.trim(), password);
      } else if (mode === 'signup') {
        const { needsConfirmation } = await auth.signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo('Compte créé ! Ouvre l’e-mail de confirmation que tu viens de recevoir, puis reviens te connecter.');
          setMode('signin');
        }
      } else {
        await auth.sendPasswordReset(email.trim());
        setInfo('Si un compte existe avec cet e-mail, tu vas recevoir un lien pour choisir un nouveau mot de passe.');
      }
    } catch (err) {
      setError(frenchAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth" style={{ backgroundImage: `url("${splashPhotoUrl('salle.webp')}")` }}>
      <div className="auth-shade" />
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <div className="page-icon">
            <DumbbellIcon />
          </div>
          <div className="auth-wordmark">
            WORK <span>&amp;</span> DISCIPLINE
          </div>
        </div>

        {mode !== 'forgot' && (
          <div className="segmented" style={{ marginBottom: 18 }}>
            <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')}>
              Se connecter
            </button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => switchMode('signup')}>
              Créer un compte
            </button>
          </div>
        )}
        {mode === 'forgot' && <h2 className="sheet-title">Mot de passe oublié</h2>}

        <div className="form-field">
          <label htmlFor="auth-email">E-mail</label>
          <input
            id="auth-email"
            className="search"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {mode !== 'forgot' && (
          <div className="form-field">
            <label htmlFor="auth-password">Mot de passe</label>
            <div className="password-row">
              <input
                id="auth-password"
                className="search"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>
        )}

        {mode === 'signup' && (
          <div className="form-field">
            <label htmlFor="auth-confirm">Confirme le mot de passe</label>
            <input
              id="auth-confirm"
              className="search"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
            />
            <span className="muted small">6 caractères minimum.</span>
          </div>
        )}

        {error && <p className="auth-error">{error}</p>}
        {info && <p className="auth-info">{info}</p>}

        <button className="btn btn-primary btn-block btn-big" type="submit" disabled={busy}>
          {busy ? '…' : mode === 'signin' ? 'Se connecter' : mode === 'signup' ? 'Créer mon compte' : 'Envoyer le lien'}
        </button>

        {mode === 'signin' && (
          <button type="button" className="link-btn auth-link" onClick={() => switchMode('forgot')}>
            Mot de passe oublié ?
          </button>
        )}
        {mode === 'forgot' && (
          <button type="button" className="link-btn auth-link" onClick={() => switchMode('signin')}>
            ← Retour à la connexion
          </button>
        )}
      </form>
    </div>
  );
}

/** Après un clic sur le lien « mot de passe oublié » reçu par e-mail. */
export function NewPasswordScreen() {
  const auth = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="auth" style={{ backgroundImage: `url("${splashPhotoUrl('salle.webp')}")` }}>
      <div className="auth-shade" />
      <form
        className="auth-card"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await auth.updatePassword(password);
          } catch (err) {
            setError(frenchAuthError(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2 className="sheet-title">Choisis un nouveau mot de passe</h2>
        <div className="form-field">
          <label htmlFor="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            className="search"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn btn-primary btn-block btn-big" type="submit" disabled={busy}>
          Enregistrer
        </button>
      </form>
    </div>
  );
}
