import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../i18n';
import { createPortal } from 'react-dom';

interface SheetProps {
  onClose: () => void;
  title?: string;
  /** Prend presque tout l'écran (listes longues). */
  full?: boolean;
  children: ReactNode;
}

/** Panneau qui glisse depuis le bas de l'écran, facile à atteindre avec le pouce. */
export function Sheet({ onClose, title, full, children }: SheetProps) {
  const startY = useRef<number | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className={`sheet${full ? ' sheet-full' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {/* En-tête toujours visible : poignée (glisser vers le bas pour fermer), titre et bouton ✕. */}
        <div
          className="sheet-head"
          onTouchStart={(e) => {
            startY.current = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            if (startY.current !== null && e.changedTouches[0].clientY - startY.current > 70) onClose();
            startY.current = null;
          }}
        >
          <div className="sheet-handle" />
          <div className="sheet-head-row">
            {title ? <h2 className="sheet-title">{title}</h2> : <span className="grow" />}
            <button type="button" className="sheet-close" onClick={onClose} aria-label={t('Fermer')}>
              ✕
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
