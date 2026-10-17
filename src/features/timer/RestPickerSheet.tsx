import { formatClock } from '../../domain/format';
import { Sheet } from '../../ui/Sheet';

export const REST_CHOICES = [30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

export function RestPickerSheet({
  title,
  current,
  onPick,
  onClose,
}: {
  title: string;
  current: number;
  onPick: (sec: number) => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose} title={title}>
      <div className="rest-grid">
        {REST_CHOICES.map((sec) => (
          <button
            key={sec}
            className={`chip rest-choice${sec === current ? ' active' : ''}`}
            onClick={() => onPick(sec)}
          >
            {formatClock(sec * 1000)}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
