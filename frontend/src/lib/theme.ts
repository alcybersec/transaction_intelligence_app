export type Theme = 'light' | 'dark'
export type AccentName = 'emerald' | 'sapphire' | 'iris' | 'amber' | 'terracotta'

interface AccentTriple {
  accent: string
  accentStrong: string
  accentFg: string
  accentSoft: string
  accentRing: string
}

interface AccentPair {
  light: AccentTriple
  dark: AccentTriple
}

export const ACCENTS: Record<AccentName, AccentPair> = {
  emerald: {
    light: {
      accent: 'oklch(0.57 0.108 157)',
      accentStrong: 'oklch(0.50 0.115 157)',
      accentFg: '#ffffff',
      accentSoft: 'oklch(0.95 0.028 157)',
      accentRing: 'oklch(0.57 0.108 157 / 0.32)',
    },
    dark: {
      accent: 'oklch(0.72 0.125 157)',
      accentStrong: 'oklch(0.78 0.13 157)',
      accentFg: '#07120c',
      accentSoft: 'oklch(0.30 0.06 157)',
      accentRing: 'oklch(0.72 0.125 157 / 0.34)',
    },
  },
  sapphire: {
    light: {
      accent: 'oklch(0.55 0.13 250)',
      accentStrong: 'oklch(0.48 0.14 250)',
      accentFg: '#ffffff',
      accentSoft: 'oklch(0.95 0.03 250)',
      accentRing: 'oklch(0.55 0.13 250 / 0.32)',
    },
    dark: {
      accent: 'oklch(0.72 0.14 250)',
      accentStrong: 'oklch(0.78 0.15 250)',
      accentFg: '#0a0f1c',
      accentSoft: 'oklch(0.30 0.07 250)',
      accentRing: 'oklch(0.72 0.14 250 / 0.34)',
    },
  },
  iris: {
    light: {
      accent: 'oklch(0.55 0.16 290)',
      accentStrong: 'oklch(0.48 0.17 290)',
      accentFg: '#ffffff',
      accentSoft: 'oklch(0.95 0.035 290)',
      accentRing: 'oklch(0.55 0.16 290 / 0.32)',
    },
    dark: {
      accent: 'oklch(0.72 0.16 290)',
      accentStrong: 'oklch(0.78 0.17 290)',
      accentFg: '#120a18',
      accentSoft: 'oklch(0.30 0.08 290)',
      accentRing: 'oklch(0.72 0.16 290 / 0.34)',
    },
  },
  amber: {
    light: {
      accent: 'oklch(0.68 0.14 75)',
      accentStrong: 'oklch(0.62 0.15 75)',
      accentFg: '#1a1300',
      accentSoft: 'oklch(0.95 0.04 80)',
      accentRing: 'oklch(0.68 0.14 75 / 0.32)',
    },
    dark: {
      accent: 'oklch(0.78 0.14 75)',
      accentStrong: 'oklch(0.84 0.15 75)',
      accentFg: '#1a1300',
      accentSoft: 'oklch(0.32 0.07 75)',
      accentRing: 'oklch(0.78 0.14 75 / 0.34)',
    },
  },
  terracotta: {
    light: {
      accent: 'oklch(0.58 0.14 35)',
      accentStrong: 'oklch(0.51 0.15 35)',
      accentFg: '#ffffff',
      accentSoft: 'oklch(0.95 0.03 35)',
      accentRing: 'oklch(0.58 0.14 35 / 0.32)',
    },
    dark: {
      accent: 'oklch(0.74 0.14 35)',
      accentStrong: 'oklch(0.80 0.15 35)',
      accentFg: '#1a0a05',
      accentSoft: 'oklch(0.30 0.07 35)',
      accentRing: 'oklch(0.74 0.14 35 / 0.34)',
    },
  },
}

const THEME_KEY = 'tt-theme'
const ACCENT_KEY = 'tt-accent'

export function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

export function readStoredAccent(): AccentName {
  const stored = localStorage.getItem(ACCENT_KEY) as AccentName | null
  if (stored && stored in ACCENTS) return stored
  return 'emerald'
}

export function applyTheme(theme: Theme, accent: AccentName): void {
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  const triple = ACCENTS[accent][theme]
  root.style.setProperty('--accent', triple.accent)
  root.style.setProperty('--accent-strong', triple.accentStrong)
  root.style.setProperty('--accent-fg', triple.accentFg)
  root.style.setProperty('--accent-soft', triple.accentSoft)
  root.style.setProperty('--accent-ring', triple.accentRing)
  localStorage.setItem(THEME_KEY, theme)
  localStorage.setItem(ACCENT_KEY, accent)
}
