import { useEffect } from 'react';
import { useRepositories, useSubscribable } from '../data';
import { applyTheme } from './theme';

/** Applique la couleur choisie dans les réglages dès qu'elle change. */
export function ThemeSync() {
  const { settings } = useRepositories();
  const current = useSubscribable(() => settings.watch(), []);
  useEffect(() => {
    if (current) applyTheme(current.theme, current.background);
  }, [current]);
  return null;
}
