// Thèmes de couleur : chaque personne choisit la couleur de son appli dans les réglages.

export type ThemeId = 'ambre' | 'feu' | 'ocean' | 'foret' | 'violet' | 'rose' | 'glace';

interface Theme {
  id: ThemeId;
  name: string;
  accent: string;
  /** Deuxième couleur, pour les dégradés. */
  accent2: string;
  /** Fonds chauds (bruns) ou froids (gris-bleus), assortis à la couleur. */
  tone: 'warm' | 'cool';
}

export const THEMES: Theme[] = [
  { id: 'ambre', name: 'Ambre', accent: '#f2a03d', accent2: '#e8642c', tone: 'warm' },
  { id: 'feu', name: 'Feu', accent: '#f25c54', accent2: '#ff9f43', tone: 'warm' },
  { id: 'rose', name: 'Rose', accent: '#f472b6', accent2: '#fb7185', tone: 'warm' },
  { id: 'violet', name: 'Violet', accent: '#a78bfa', accent2: '#ec4899', tone: 'cool' },
  { id: 'ocean', name: 'Océan', accent: '#4f9dff', accent2: '#7c5cff', tone: 'cool' },
  { id: 'glace', name: 'Glace', accent: '#22d3ee', accent2: '#3b82f6', tone: 'cool' },
  { id: 'foret', name: 'Forêt', accent: '#4ade80', accent2: '#22d3ee', tone: 'cool' },
];

export const DEFAULT_THEME: ThemeId = 'ambre';

const SURFACES = {
  warm: {
    '--bg': '#0b0a09',
    '--surface': '#17130f',
    '--surface-2': '#221c17',
    '--surface-3': '#30281f',
    '--border': '#372d24',
    '--text': '#f6f0e8',
    '--text-dim': '#ab9c8c',
  },
  cool: {
    '--bg': '#0d0f13',
    '--surface': '#161a21',
    '--surface-2': '#20252f',
    '--surface-3': '#2b313d',
    '--border': '#2f3542',
    '--text': '#f1f3f7',
    '--text-dim': '#9aa3b5',
  },
};

export function themeById(id: string | undefined): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** "#f2a03d" → "242, 160, 61" (pour rgba(var(--accent-rgb), 0.15)). */
export function hexToRgb(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/** Variables CSS d'un thème. */
export function themeVariables(id: string | undefined): Record<string, string> {
  const t = themeById(id);
  return {
    ...SURFACES[t.tone],
    '--accent': t.accent,
    '--accent-2': t.accent2,
    '--accent-rgb': hexToRgb(t.accent),
    '--accent-2-rgb': hexToRgb(t.accent2),
  };
}

const STORAGE_KEY = 'wd-theme';

/** Applique le thème à toute l'appli et le mémorise pour l'afficher sans délai à la prochaine ouverture. */
export function applyTheme(id: string | undefined) {
  const root = document.documentElement;
  const vars = themeVariables(id);
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--bg']);
  try {
    localStorage.setItem(STORAGE_KEY, themeById(id).id);
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}

/** Thème mémorisé lors de la dernière utilisation (avant que la base de données soit lue). */
export function cachedTheme(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
