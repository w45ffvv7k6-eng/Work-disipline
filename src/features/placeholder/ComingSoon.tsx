import type { ReactNode } from 'react';
import { PageHeader } from '../../ui/PageHeader';

export function ComingSoon({
  title,
  subtitle,
  icon,
  step,
}: {
  title: string;
  subtitle: string;
  icon: ReactNode;
  step: string;
}) {
  return (
    <div className="screen">
      <PageHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="empty">
        <div className="big">🚧</div>
        <p>Cet écran arrive à l’étape « {step} ».</p>
      </div>
    </div>
  );
}
