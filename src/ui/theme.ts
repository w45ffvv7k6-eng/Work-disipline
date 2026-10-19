// Thèmes : chaque personne choisit la couleur principale de son appli et la couleur du fond.

export type ThemeId = 'ambre' | 'feu' | 'ocean' | 'foret' | 'violet' | 'rose' | 'glace';

interface Theme {
  id: ThemeId;
  name: string;
  accent: string;
  /** Deuxième couleur, pour les dégradés. */
  accent2: string;
  /** Fond assorti quand le fond est réglé sur « Assorti ». */
  background: BackgroundId;
}

export const THEMES: Theme[] = [
  { id: 'ambre', name: 'Ambre', accent: '#f2a03d', accent2: '#e8642c', background: 'chaud' },
  { id: 'feu', name: 'Feu', accent: '#f25c54', accent2: '#ff9f43', background: 'chaud' },
  { id: 'rose', name: 'Rose', accent: '#f472b6', accent2: '#fb7185', background: 'chaud' },
  { id: 'violet', name: 'Violet', accent: '#a78bfa', accent2: '#ec4899', background: 'bleute' },
  { id: 'ocean', name: 'Océan', accent: '#4f9dff', accent2: '#7c5cff', background: 'bleute' },
  { id: 'glace', name: 'Glace', accent: '#22d3ee', accent2: '#3b82f6', background: 'bleute' },
  { id: 'foret', name: 'Forêt', accent: '#4ade80', accent2: '#22d3ee', background: 'bleute' },
];

export type BackgroundId =
  'assorti' | 'chaud' | 'bleute' | 'pur' | 'anthracite' | 'nuit' | 'cafe' | 'sapin' | 'bordeaux' | 'aubergine';

/** Fonds proposés : la couleur de base ; les cartes et bordures en sont dérivées. */
export const BACKGROUNDS: { id: Exclude<BackgroundId, 'assorti'>; name: string; base: string }[] = [
  { id: 'chaud', name: 'Noir chaud', base: '#0b0a09' },
  { id: 'bleute', name: 'Noir bleuté', base: '#0d0f13' },
  { id: 'pur', name: 'Noir pur', base: '#000000' },
  { id: 'anthracite', name: 'Anthracite', base: '#1a1b1f' },
  { id: 'nuit', name: 'Bleu nuit', base: '#0a1124' },
  { id: 'cafe', name: 'Café', base: '#1a100a' },
  { id: 'sapin', name: 'Sapin', base: '#07160f' },
  { id: 'bordeaux', name: 'Bordeaux', base: '#1c0a0f' },
  { id: 'aubergine', name: 'Aubergine', base: '#140b1f' },
];

export const DEFAULT_THEME: ThemeId = 'ambre';
export const DEFAULT_BACKGROUND: BackgroundId = 'assorti';

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Fond effectif : « Assorti » prend celui du thème. */
export function backgroundFor(themeId: string | undefined, backgroundId: string | undefined) {
  const id = backgroundId && backgroundId !== 'assorti' ? backgroundId : themeById(themeId).background;
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}

/** "#f2a03d" → "242, 160, 61" (pour rgba(var(--accent-rgb), 0.15)). */
export function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Mélange une couleur avec du blanc : ratio 0 = couleur d'origine, 1 = blanc. */
export function lighten(hex: string, ratio: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 255;
    return Math.round(c + (255 - c) * ratio)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${channel(16)}${channel(8)}${channel(0)}`;
}

/** Variables CSS d'un thème et d'un fond. */
export function themeVariables(themeId: string | undefined, backgroundId?: string): Record<string, string> {
  const t = themeById(themeId);
  const bg = backgroundFor(themeId, backgroundId).base;
  return {
    '--bg': bg,
    '--bg-rgb': hexToRgb(bg),
    '--surface': lighten(bg, 0.05),
    '--surface-2': lighten(bg, 0.09),
    '--surface-3': lighten(bg, 0.14),
    '--border': lighten(bg, 0.16),
    '--text': lighten(bg, 0.94),
    '--text-dim': lighten(bg, 0.6),
    '--accent': t.accent,
    '--accent-2': t.accent2,
    '--accent-rgb': hexToRgb(t.accent),
    '--accent-2-rgb': hexToRgb(t.accent2),
  };
}

const STORAGE_KEY = 'wd-theme';

/** Applique le thème à toute l'appli et le mémorise pour l'afficher sans délai à la prochaine ouverture. */
export function applyTheme(themeId: string | undefined, backgroundId?: string) {
  const root = document.documentElement;
  const vars = themeVariables(themeId, backgroundId);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg']);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: themeId, background: backgroundId }));
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}

/** Thème mémorisé lors de la dernière utilisation (avant que la base de données soit lue). */
export function cachedTheme(): { theme?: string; background?: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    // Ancien format : juste l'identifiant du thème.
    return raw.startsWith('{') ? JSON.parse(raw) : { theme: raw };
  } catch {
    return {};
  }
}
