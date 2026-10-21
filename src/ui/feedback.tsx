import { t } from '../i18n';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Sheet } from './Sheet';

/** Petite vibration de confirmation (Android uniquement : l'iPhone ne la permet pas). */
export function haptic(pattern: number | number[] = 15) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignoré
  }
}

// ---------- Messages éphémères (toasts) ----------

type ToastTone = 'default' | 'gold';
interface ToastState {
  id: number;
  text: string;
  tone: ToastTone;
}

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  danger?: boolean;
}

interface FeedbackApi {
  toast(text: string, tone?: ToastTone): void;
  confirm(options: ConfirmOptions): Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackApi | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((text: string, tone: ToastTone = 'default') => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), text, tone });
    timer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...options, resolve })),
    [],
  );

  const closeConfirm = (ok: boolean) => {
    confirmState?.resolve(ok);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ toast: showToast, confirm }}>
      {children}
      {toast && (
        <div
          key={toast.id}
          className={`toast${toast.tone === 'gold' ? ' gold' : ''}`}
          role="status"
          onClick={() => setToast(null)}
        >
          {toast.text}
        </div>
      )}
      {confirmState && (
        <Sheet onClose={() => closeConfirm(false)} title={confirmState.title}>
          {confirmState.message && <p className="muted">{confirmState.message}</p>}
          <div className="stack" style={{ marginTop: 16 }}>
            <button
              className={`btn btn-block ${confirmState.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => closeConfirm(true)}
            >
              {confirmState.confirmLabel}
            </button>
            <button className="btn btn-block btn-ghost" onClick={() => closeConfirm(false)}>
              {t('Annuler')}
            </button>
          </div>
        </Sheet>
      )}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackApi {
  const api = useContext(FeedbackContext);
  if (!api) throw new Error('FeedbackProvider manquant');
  return api;
}
