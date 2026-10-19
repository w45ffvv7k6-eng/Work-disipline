import type { ReactNode } from 'react';

/** En-tête d'écran : icône dans un badge coloré, titre et sous-titre. */
export function PageHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-icon" aria-hidden="true">
        {icon}
      </div>
      <div className="grow">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

/** Initiales pour l'avatar : "Rafael Paulo" → "RP". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
}
