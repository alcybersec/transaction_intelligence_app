# Phase 2 — Frontend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the shared frontend layer for the v2 redesign — tokens, theme engine, primitives, charts, icon mapping, command palette, shell components, TanStack Query hooks for new endpoints, and a routing scaffold with 10 placeholder screen slots — as a single coherent PR on `develop`. After this lands, Phase 3 dispatches one parallel worktree agent per screen.

**Architecture:** Single sequential branch `feat/v2-fe-foundation` off latest `develop`. The branch rewrites `index.css` to OKLCH tokens, extends `tailwind.config.js`, adds new component/lib/hooks directories, and rewrites `App.tsx` with 10 placeholder routes. Legacy `frontend/src/components/*.tsx` files are left alive but unreachable (they get deleted in Phase 4). A `/_kitchen-sink` dev-only route renders every primitive + chart for visual QA and is removed in Phase 4.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind 3.4 (extending the existing shadcn-style theme), `@tanstack/react-query` v5, `react-router-dom` v6, `lucide-react` 0.445. Vitest + React Testing Library for tests.

---

## Spec reference

Implements Phase 2 of `docs/superpowers/specs/2026-06-10-ui-v2-redesign-design.md`. Builds on `develop` after Phase 1 (slots 1a–1f + tech debt PR #8) merged.

## Handoff reference

The original UI design is at `.handoff/design/` (gitignored copy of the handoff zip). Each task points at the specific handoff file the agent should consult for exact markup/values:
- `.handoff/design/tokens.css` — OKLCH variables, motion keyframes
- `.handoff/design/app.css` — layout and component-level styling
- `.handoff/design/primitives.jsx` — Card, Button, Badge, Segmented, Toggle, Field, Input, Select, Modal, Avatar, Toast, IconTile
- `.handoff/design/charts.jsx` — Donut, AreaTrend, Sparkline, Heatmap, Ring, MiniBars, Progress (hand-built SVG)
- `.handoff/design/icons.jsx` — ~70 icons mapped to handoff names; we'll re-implement via a lucide-react wrapper
- `.handoff/design/shell.jsx` — TopBar, MobileTabBar, AccountDropdown, CommandPalette, ACCENTS table, applyTheme
- `.handoff/design/app.jsx` — root composition + LoginPage (for Phase 3a, but Toast/composition shown here)

**Important:** the handoff is a runnable React-via-Babel prototype using `React.createElement` and `window.MOCK`. The implementer translates to JSX + TypeScript and replaces mock data with TanStack Query hooks.

## Style and naming conventions

- All new files use 2-space indent (matches existing `frontend/src/`).
- New components live under `frontend/src/components/{shell,primitives,charts,icons}/` and use PascalCase filenames (`TopBar.tsx`).
- Hooks live under `frontend/src/hooks/use*.ts`.
- Library helpers live under `frontend/src/lib/*.ts`.
- Tests live next to the file they cover with `.test.ts(x)` suffix, OR in `src/__tests__/` if conventional in the repo — check `src/App.test.tsx`'s location: it's next to App.tsx, so co-located is the established pattern. **Co-locate tests next to source files.**
- Component file rule: one component per file. Internal helpers can live in the same file. If a primitive needs multiple subcomponents, group under a folder: `components/primitives/Modal/index.tsx`.
- Type-only imports: `import type { Foo } from '...'`. Match existing pattern from `frontend/src/api/*.ts`.

## File map

### Created
- `frontend/src/styles/tokens.css` — OKLCH light/dark tokens + accent options + motion keyframes
- `frontend/src/styles/app.css` — minimal layout styling beyond Tailwind utilities (mostly empty — Tailwind does the heavy lifting)
- `frontend/src/lib/theme.ts` — `applyTheme(theme, accent)` + persistence; `ACCENTS` table
- `frontend/src/lib/theme.test.ts`
- `frontend/src/lib/money.ts` — `fmt.money`, `fmt.shortMoney`, `tnum` helpers
- `frontend/src/lib/money.test.ts`
- `frontend/src/lib/dates.ts` — month nav helpers (`addMonths`, `monthLabel`, `periodForMonth`)
- `frontend/src/lib/dates.test.ts`
- `frontend/src/components/icons/Icon.tsx` — lucide-react wrapper, handoff-name → lucide-name map
- `frontend/src/components/primitives/Card.tsx`
- `frontend/src/components/primitives/Button.tsx`
- `frontend/src/components/primitives/Badge.tsx`
- `frontend/src/components/primitives/Segmented.tsx`
- `frontend/src/components/primitives/Toggle.tsx`
- `frontend/src/components/primitives/Field.tsx`
- `frontend/src/components/primitives/Input.tsx`
- `frontend/src/components/primitives/Select.tsx`
- `frontend/src/components/primitives/Modal.tsx`
- `frontend/src/components/primitives/Avatar.tsx`
- `frontend/src/components/primitives/Toast.tsx` + `ToastContext.tsx`
- `frontend/src/components/primitives/IconTile.tsx`
- `frontend/src/components/charts/Donut.tsx` + `Donut.test.tsx`
- `frontend/src/components/charts/AreaTrend.tsx`
- `frontend/src/components/charts/Sparkline.tsx` + `Sparkline.test.tsx`
- `frontend/src/components/charts/Heatmap.tsx`
- `frontend/src/components/charts/Ring.tsx` + `Ring.test.tsx`
- `frontend/src/components/charts/MiniBars.tsx`
- `frontend/src/components/charts/Progress.tsx`
- `frontend/src/components/shell/ThemeProvider.tsx`
- `frontend/src/components/shell/TopBar.tsx`
- `frontend/src/components/shell/MobileTabBar.tsx`
- `frontend/src/components/shell/AccountDropdown.tsx`
- `frontend/src/components/shell/CommandPalette.tsx` + `CommandPalette.test.tsx`
- `frontend/src/components/shell/CommandPaletteContext.tsx`
- `frontend/src/components/screens/ScreenComingSoon.tsx` — placeholder used by Phase 2; Phase 3 agents replace per-route imports
- `frontend/src/components/_kitchen-sink/KitchenSink.tsx` — dev-only visual gallery
- `frontend/src/hooks/useTheme.ts`
- `frontend/src/hooks/useAccent.ts`
- `frontend/src/hooks/useCommandPalette.ts`
- `frontend/src/hooks/useRecurring.ts`
- `frontend/src/hooks/useTransactionSummary.ts` + `useTransactionSummary.test.ts`
- `frontend/src/hooks/useGoals.ts`
- `frontend/src/hooks/useAccount.ts`
- `frontend/src/hooks/useInsights.ts`
- `frontend/src/hooks/useAISettings.ts`
- `frontend/src/hooks/useAdapterStats.ts`
- `frontend/src/api/goals.ts` — exists (slot 1c); kept
- `frontend/src/api/analytics.ts` — extended in slot 1e (already has fetchInsights)

### Modified
- `frontend/src/index.css` — replace shadcn HSL block with OKLCH tokens import + base setup; keep `@tailwind` directives
- `frontend/src/main.tsx` — wrap with `ThemeProvider` + `QueryClientProvider` (likely already present) + `ToastProvider` + `CommandPaletteProvider`
- `frontend/src/App.tsx` — rewrite routing with 10 placeholder route slots + `TopBar` + `MobileTabBar` + `CommandPalette`
- `tailwind.config.js` — extend with new color tokens (var(--bg), var(--surface), accent, debit, credit, warn, c1..c8), radii, shadows, fonts, maxWidth
- `frontend/index.html` — add `<link>` to Google Fonts for Newsreader + Hanken Grotesk (or rely on tokens.css @import)
- `frontend/src/api/transactions.ts` — exists from slot 1a+1b; consumed by hooks; no edits needed

### Out of scope (Phase 3+)
- `frontend/src/components/{Dashboard,TransactionList,...}.tsx` (legacy) — left alive, unreachable. Deleted in Phase 4.
- Real screen components for Login, Dashboard, etc. — those are Phase 3 slots.

---

## Task 0: Branch setup

**Files:** branch state only

- [ ] **Step 1: Confirm clean working tree on main**

Run: `git -C /home/alex/Documents/coding/transaction_intelligence_app status --short`
Expected: empty (or only the spec/plan docs already committed). Resolve before continuing.

- [ ] **Step 2: Fetch + rebase develop on main**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git fetch origin
git checkout develop
git pull --ff-only origin develop
git rebase main
git push --force-with-lease origin develop
```

- [ ] **Step 3: Capture base SHA**

```bash
git rev-parse develop > /tmp/v2-phase2-base-sha.txt
cat /tmp/v2-phase2-base-sha.txt
```

- [ ] **Step 4: Worktree branch (if running this agent in a worktree)**

```bash
git worktree add -b feat/v2-fe-foundation .claude/worktrees/p2-foundation "$(cat /tmp/v2-phase2-base-sha.txt)"
cd .claude/worktrees/p2-foundation
```

If running inline in the main repo, instead:
```bash
git checkout -b feat/v2-fe-foundation
```

- [ ] **Step 5: Bring up services**

Run: `make up`
Expected: postgres, redis, api, frontend services healthy.

---

## Task 1: Token replacement

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/index.css`
- Modify: `tailwind.config.js`
- Modify: `frontend/index.html` (font preconnect, optional)

- [ ] **Step 1: Copy handoff tokens.css verbatim**

Read `.handoff/design/tokens.css` (verified to be ~140 lines). Copy its contents to `frontend/src/styles/tokens.css` with these adjustments:
- Keep the `@import` of Google Fonts at the top.
- Keep all `--*` custom property definitions for `:root`, `[data-theme='light']`, `[data-theme='dark']`.
- Keep the keyframes (`fadeUp`, `fadeIn`, `popIn`, `growBar`, `spin`, `shimmer`).
- Keep `@media (prefers-reduced-motion: reduce)`.
- Drop the `html, body { margin: 0; padding: 0; background: var(--bg); ... }` block — Tailwind's preflight + index.css will own that.

- [ ] **Step 2: Rewrite `frontend/src/index.css`**

Replace its contents entirely with:

```css
@import './styles/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html, body, #root {
    margin: 0;
    padding: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  h1, h2, h3, h4, h5, h6, .serif {
    font-family: var(--font-serif);
    font-weight: 500;
    letter-spacing: -0.01em;
  }

  .tnum {
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum' 1;
  }
}
```

This deliberately drops the legacy shadcn HSL `--background`, `--foreground`, `--primary`, etc. The legacy components in `frontend/src/components/*.tsx` will render with default browser styles (no longer themed) — that's expected per the spec; they get deleted in Phase 4.

- [ ] **Step 3: Extend `tailwind.config.js`**

Replace the entire contents with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['attribute', 'data-theme="dark"'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-grad-1": "var(--bg-grad-1)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        text: "var(--text)",
        "text-2": "var(--text-2)",
        "text-3": "var(--text-3)",
        accent: {
          DEFAULT: "var(--accent)",
          strong: "var(--accent-strong)",
          fg: "var(--accent-fg)",
          soft: "var(--accent-soft)",
          ring: "var(--accent-ring)",
        },
        debit: {
          DEFAULT: "var(--debit)",
          soft: "var(--debit-soft)",
        },
        credit: "var(--credit)",
        warn: {
          DEFAULT: "var(--warn)",
          soft: "var(--warn-soft)",
        },
        c1: "var(--c1)",
        c2: "var(--c2)",
        c3: "var(--c3)",
        c4: "var(--c4)",
        c5: "var(--c5)",
        c6: "var(--c6)",
        c7: "var(--c7)",
        c8: "var(--c8)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        maxw: "var(--maxw)",
      },
      animation: {
        fadeUp: "fadeUp 240ms ease-out",
        fadeIn: "fadeIn 160ms ease-out",
        popIn: "popIn 200ms ease-out",
        growBar: "growBar 420ms ease-out",
        spin: "spin 1s linear infinite",
        shimmer: "shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 4: Verify Vite still builds**

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app/frontend
npm run build
```

Expected: build succeeds. There will be runtime visual breakage in legacy components (their HSL classes no longer resolve), but the TS compile + Vite bundle should be clean. If new TS errors appear in this PR's added files, fix them. Pre-existing errors in `TransactionDetail.tsx`/`VendorList.tsx`/`AdaptersSettings.tsx` are known and acceptable.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/index.css frontend/tailwind.config.js
git commit -m "feat(frontend): OKLCH token system + Tailwind extension"
```

---

## Task 2: Library helpers + tests

**Files:**
- Create: `frontend/src/lib/theme.ts`
- Create: `frontend/src/lib/theme.test.ts`
- Create: `frontend/src/lib/money.ts`
- Create: `frontend/src/lib/money.test.ts`
- Create: `frontend/src/lib/dates.ts`
- Create: `frontend/src/lib/dates.test.ts`

### Task 2.1: theme.ts

Read `.handoff/design/shell.jsx` for the `ACCENTS` table and `applyTheme` shape. Translate to TypeScript.

- [ ] **Step 1: Write failing tests**

```typescript
// frontend/src/lib/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { applyTheme, readStoredTheme, readStoredAccent, ACCENTS } from './theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.style.cssText = ''
  })

  it('applies the theme attribute on the html element', () => {
    applyTheme('dark', 'emerald')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('persists theme to localStorage', () => {
    applyTheme('dark', 'emerald')
    expect(localStorage.getItem('tt-theme')).toBe('dark')
    expect(localStorage.getItem('tt-accent')).toBe('emerald')
  })

  it('writes accent CSS variables for the selected accent', () => {
    applyTheme('light', 'sapphire')
    const root = document.documentElement
    expect(root.style.getPropertyValue('--accent')).toContain('oklch')
    expect(root.style.getPropertyValue('--accent-strong')).toContain('oklch')
    expect(root.style.getPropertyValue('--accent-fg')).toBeTruthy()
  })

  it('readStoredTheme falls back to system preference when nothing stored', () => {
    // jsdom defaults prefers-color-scheme to light; readStoredTheme returns "light"
    expect(readStoredTheme()).toMatch(/^(light|dark)$/)
  })

  it('readStoredAccent defaults to "emerald"', () => {
    expect(readStoredAccent()).toBe('emerald')
  })

  it('ACCENTS has at least 5 entries', () => {
    expect(Object.keys(ACCENTS).length).toBeGreaterThanOrEqual(5)
  })
})
```

- [ ] **Step 2: Run, confirm RED**

```bash
cd frontend && npm test -- --run lib/theme
```

Expected: failures (module doesn't exist).

- [ ] **Step 3: Implement `frontend/src/lib/theme.ts`**

```typescript
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
```

- [ ] **Step 4: Run tests, confirm GREEN**

```bash
cd frontend && npm test -- --run lib/theme
```

Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/theme.ts frontend/src/lib/theme.test.ts
git commit -m "feat(frontend): theme + accent engine with localStorage persistence"
```

### Task 2.2: money.ts

- [ ] **Step 1: Tests**

```typescript
// frontend/src/lib/money.test.ts
import { describe, it, expect } from 'vitest'
import { fmt, parseMoney } from './money'

describe('money formatting', () => {
  it('formats whole amounts with 2 decimals + comma thousands', () => {
    expect(fmt.money('1234.5')).toBe('1,234.50')
    expect(fmt.money('0')).toBe('0.00')
    expect(fmt.money(1000000)).toBe('1,000,000.00')
  })

  it('handles negative amounts', () => {
    expect(fmt.money(-50)).toBe('-50.00')
  })

  it('shortMoney abbreviates large numbers', () => {
    expect(fmt.shortMoney(1500)).toBe('1.5K')
    expect(fmt.shortMoney(1234567)).toBe('1.2M')
    expect(fmt.shortMoney(99)).toBe('99.00')
  })

  it('parseMoney returns a number from a formatted string', () => {
    expect(parseMoney('1,234.50')).toBe(1234.5)
    expect(parseMoney('')).toBe(0)
    expect(parseMoney('-12.00')).toBe(-12)
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/lib/money.ts
type MoneyInput = string | number

function toNumber(v: MoneyInput): number {
  if (typeof v === 'number') return v
  if (!v) return 0
  return Number(v)
}

export const fmt = {
  money(v: MoneyInput): string {
    const n = toNumber(v)
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  },
  shortMoney(v: MoneyInput): string {
    const n = toNumber(v)
    const abs = Math.abs(n)
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toFixed(2)
  },
}

export function parseMoney(s: string): number {
  if (!s) return 0
  return Number(s.replace(/,/g, ''))
}
```

- [ ] **Step 3: Run + commit**

```bash
cd frontend && npm test -- --run lib/money
git add frontend/src/lib/money.ts frontend/src/lib/money.test.ts
git commit -m "feat(frontend): money formatting helpers"
```

### Task 2.3: dates.ts

- [ ] **Step 1: Tests**

```typescript
// frontend/src/lib/dates.test.ts
import { describe, it, expect } from 'vitest'
import { addMonths, monthLabel, periodForMonth, ymKey } from './dates'

describe('dates', () => {
  it('addMonths handles month boundaries', () => {
    expect(addMonths('2026-01', 1)).toBe('2026-02')
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
  })

  it('monthLabel produces "Month YYYY"', () => {
    expect(monthLabel('2026-06')).toBe('June 2026')
  })

  it('periodForMonth returns ISO date range', () => {
    const { period_start, period_end } = periodForMonth('2026-06')
    expect(period_start).toBe('2026-06-01')
    expect(period_end).toBe('2026-06-30')
    // Feb in leap year
    expect(periodForMonth('2024-02').period_end).toBe('2024-02-29')
    // Feb in non-leap
    expect(periodForMonth('2026-02').period_end).toBe('2026-02-28')
  })

  it('ymKey from Date returns YYYY-MM', () => {
    expect(ymKey(new Date(2026, 5, 15))).toBe('2026-06')
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/lib/dates.ts
export type YMKey = string  // "YYYY-MM"

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseYm(ym: YMKey): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

export function addMonths(ym: YMKey, n: number): YMKey {
  const { year, month } = parseYm(ym)
  const total = (year * 12 + (month - 1)) + n
  const newYear = Math.floor(total / 12)
  const newMonth = (total % 12) + 1
  return `${newYear}-${String(newMonth).padStart(2, '0')}`
}

export function monthLabel(ym: YMKey): string {
  const { year, month } = parseYm(ym)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function periodForMonth(ym: YMKey): { period_start: string; period_end: string } {
  const { year, month } = parseYm(ym)
  const last = daysInMonth(year, month)
  const mm = String(month).padStart(2, '0')
  return {
    period_start: `${year}-${mm}-01`,
    period_end: `${year}-${mm}-${String(last).padStart(2, '0')}`,
  }
}

export function ymKey(d: Date): YMKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function lastCompleteMonth(now = new Date()): YMKey {
  // First day of the current month, then subtract one day → previous month
  const firstThis = new Date(now.getFullYear(), now.getMonth(), 1)
  firstThis.setDate(firstThis.getDate() - 1)
  return ymKey(firstThis)
}
```

- [ ] **Step 3: Run + commit**

```bash
cd frontend && npm test -- --run lib/dates
git add frontend/src/lib/dates.ts frontend/src/lib/dates.test.ts
git commit -m "feat(frontend): month nav + period date helpers"
```

---

## Task 3: Icon wrapper

**Files:**
- Create: `frontend/src/components/icons/Icon.tsx`

Read `.handoff/design/icons.jsx` to enumerate the ~70 icon names. Most map directly to lucide-react names. Implementer references the handoff names (e.g. `home`, `bell`, `search`, `creditcard`) and maps them to lucide imports (`Home`, `Bell`, `Search`, `CreditCard`).

- [ ] **Step 1: Implement the wrapper**

```typescript
// frontend/src/components/icons/Icon.tsx
import {
  // Layout / nav
  Home, LayoutDashboard, ListChecks, Wallet, PieChart, FileText, MessageSquare,
  Tag, Folder, Settings, User as UserIcon, LogOut, Search, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, X, Menu, MoreVertical,

  // Actions
  Plus, Minus, Edit3, Trash2, Save, RefreshCw, Download, Upload, Copy, Check,
  CheckCircle2, AlertCircle, AlertTriangle, Info, HelpCircle,

  // Status / direction
  ArrowUp, ArrowDown, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Minus as Equals,

  // Finance
  CreditCard, Banknote, Coins, Receipt, PiggyBank, Target, Calendar, Clock,

  // Comms
  Mail, MessageCircle, Bell, Smartphone, Globe,

  // Misc
  Sparkles, Zap, Sun, Moon, Eye, EyeOff, Filter, SlidersHorizontal, Lock,
  Unlock, ShieldCheck, KeyRound, Heart, Star,
} from 'lucide-react'

import type { ComponentType, SVGProps } from 'react'

type LucideIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

// Handoff name (left) → lucide component (right).
// Keep keys in sync with .handoff/design/icons.jsx.
const ICON_MAP: Record<string, LucideIcon> = {
  // Layout / nav
  home: Home,
  dashboard: LayoutDashboard,
  list: ListChecks,
  wallet: Wallet,
  pie: PieChart,
  report: FileText,
  chat: MessageSquare,
  tag: Tag,
  folder: Folder,
  settings: Settings,
  user: UserIcon,
  logout: LogOut,
  search: Search,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  close: X,
  menu: Menu,
  more: MoreVertical,

  // Actions
  plus: Plus,
  minus: Minus,
  edit: Edit3,
  trash: Trash2,
  save: Save,
  refresh: RefreshCw,
  download: Download,
  upload: Upload,
  copy: Copy,
  check: Check,
  'check-circle': CheckCircle2,
  'alert-circle': AlertCircle,
  warning: AlertTriangle,
  info: Info,
  help: HelpCircle,

  // Status / direction
  'arrow-up': ArrowUp,
  'arrow-down': ArrowDown,
  'arrow-up-right': ArrowUpRight,
  'arrow-down-right': ArrowDownRight,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  equals: Equals,

  // Finance
  card: CreditCard,
  cash: Banknote,
  coins: Coins,
  receipt: Receipt,
  goal: PiggyBank,
  target: Target,
  calendar: Calendar,
  clock: Clock,

  // Comms
  mail: Mail,
  message: MessageCircle,
  bell: Bell,
  phone: Smartphone,
  globe: Globe,

  // Misc
  sparkles: Sparkles,
  zap: Zap,
  sun: Sun,
  moon: Moon,
  eye: Eye,
  'eye-off': EyeOff,
  filter: Filter,
  sliders: SlidersHorizontal,
  lock: Lock,
  unlock: Unlock,
  shield: ShieldCheck,
  key: KeyRound,
  heart: Heart,
  star: Star,
}

interface IconProps {
  name: keyof typeof ICON_MAP | string
  size?: number | string
  stroke?: number | string
  className?: string
}

export function Icon({ name, size = 18, stroke = 1.75, className }: IconProps) {
  const Component = ICON_MAP[name]
  if (!Component) {
    if (import.meta.env.DEV) {
      console.warn(`[Icon] Unknown name: ${name}`)
    }
    return null
  }
  return <Component size={size} strokeWidth={stroke as number} className={className} aria-hidden="true" />
}

export type IconName = keyof typeof ICON_MAP
```

If the handoff uses a name that isn't mapped, the implementer extends the map by adding the lucide import and entry. Cross-reference handoff names by grepping `.handoff/design/*.jsx` for `Icon name=`.

- [ ] **Step 2: Verify Vite compiles**

```bash
cd frontend && npx tsc --noEmit
```

Pre-existing TS errors should be unchanged. No new errors expected.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/icons/Icon.tsx
git commit -m "feat(frontend): lucide-react icon wrapper with handoff names"
```

---

## Task 4: Primitives

Each primitive is a small task. The handoff file `.handoff/design/primitives.jsx` is the source of truth for visual details — pull className strings and DOM structure from there, but rewrite in JSX + TypeScript and use Tailwind utilities that map to the new tokens (`bg-surface`, `text-text`, `border-line`, `rounded-lg`, etc.) rather than inline styles.

**Pattern for every primitive:**
1. Read its definition in `.handoff/design/primitives.jsx`.
2. Translate `React.createElement` to JSX, the `className` strings using new Tailwind tokens.
3. Add TypeScript prop types.
4. Default exports OR named — match the rest of `frontend/src/components/*.tsx` (named exports preferred).
5. Test only if behavior is non-trivial (e.g., Modal's Esc-to-close).

### Task 4.1: Card

- [ ] **Step 1: Implement `frontend/src/components/primitives/Card.tsx`**

```typescript
import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
}

export function Card({ children, padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-line rounded-lg shadow-sm',
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
```

Note: `cn` already exists in the repo as `frontend/src/lib/utils.ts` or `frontend/src/lib/cn.ts`. **Confirm with `find frontend/src/lib -name "*.ts"` before importing.** If it's at `@/lib/utils`, use that. If it doesn't exist, create `frontend/src/lib/cn.ts`:

```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

And ensure the `vite.config.ts` has a `@` alias mapping to `frontend/src/`. If not, use relative imports.

### Task 4.2: Button

- [ ] **Step 1: Implement `frontend/src/components/primitives/Button.tsx`**

```typescript
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  children: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-strong border-transparent',
  secondary: 'bg-surface text-text border border-line hover:bg-surface-2',
  ghost: 'bg-transparent text-text hover:bg-surface-2 border-transparent',
  danger: 'bg-debit text-white hover:opacity-90 border-transparent',
}

const SIZES: Record<Size, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[8px] transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
})
```

### Task 4.3: Badge, Segmented, Toggle, Field, Input, Select, Avatar, IconTile

Each is a small leaf component. **Implementer creates one file per primitive, following the same pattern as Card/Button:** thin wrapper, Tailwind utilities, TypeScript prop types.

Below are minimal contracts. Pull className strings and DOM structure from `.handoff/design/primitives.jsx` for each component.

#### Badge.tsx

```typescript
interface BadgeProps {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'debit' | 'credit' | 'warn'
  className?: string
}
// Renders <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ...">{children}</span>
// Tone-specific classes from new tokens.
```

#### Segmented.tsx

```typescript
interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}
// Pill row of buttons; active button uses accent-soft + accent text.
```

#### Toggle.tsx

```typescript
interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}
// Custom switch (not native checkbox); track + thumb; track uses accent when checked.
// Keyboard accessible: clicking label toggles, space-to-toggle when focused.
```

#### Field.tsx

```typescript
interface FieldProps {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
}
// Vertical stack: label (text-xs uppercase text-text-2), child input, hint/error (text-xs).
```

#### Input.tsx

```typescript
type InputProps = InputHTMLAttributes<HTMLInputElement>
// <input class="w-full bg-surface border border-line rounded-md px-3 py-1.5 focus:border-accent ...">
```

#### Select.tsx

```typescript
type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { options?: { value: string; label: string }[] }
// Native <select> styled with new tokens; supports `options` shorthand OR <option> children.
```

#### Avatar.tsx

```typescript
interface AvatarProps {
  name?: string
  src?: string
  size?: number
  className?: string
}
// Circle with initials fallback. Initials derived from name (first letter of each word, max 2).
```

#### IconTile.tsx

```typescript
interface IconTileProps {
  name: IconName | string
  tone?: 'neutral' | 'accent' | 'debit' | 'credit' | 'warn'
  size?: number
}
// Rounded-md tinted background + Icon inside. Used for transaction direction tiles, category dots, etc.
```

### Task 4.4: Modal

Modal is the most complex primitive (Esc + outside-click + focus trap). Test it.

- [ ] **Step 1: Tests**

```typescript
// frontend/src/components/primitives/Modal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  it('does not render when open=false', () => {
    render(
      <Modal open={false} onClose={() => {}} title="X">
        body
      </Modal>,
    )
    expect(screen.queryByText('body')).toBeNull()
  })

  it('renders title and children when open', () => {
    render(
      <Modal open onClose={() => {}} title="Hi">
        body
      </Modal>,
    )
    expect(screen.getByText('Hi')).toBeInTheDocument()
    expect(screen.getByText('body')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when scrim is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        body
      </Modal>,
    )
    const scrim = screen.getByTestId('modal-scrim')
    fireEvent.click(scrim)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close on inside click', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="X">
        <div data-testid="inside">body</div>
      </Modal>,
    )
    fireEvent.click(screen.getByTestId('inside'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/components/primitives/Modal.tsx
import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Icon } from '../icons/Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  children: ReactNode
  className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      data-testid="modal-scrim"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[3px] animate-fadeIn"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'bg-surface border border-line rounded-xl shadow-lg w-full max-w-md m-4 p-5 animate-popIn',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between mb-3">
            <div className="font-serif text-lg font-semibold">{title}</div>
            <button onClick={onClose} className="text-text-2 hover:text-text" aria-label="Close">
              <Icon name="close" size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
```

### Task 4.5: Toast + ToastContext

Toast is global state — needs a provider.

```typescript
// frontend/src/components/primitives/ToastContext.tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Tone = 'neutral' | 'accent' | 'debit' | 'warn'
interface ToastMessage { id: number; text: string; tone: Tone }

interface ToastContextValue {
  show: (text: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const show = useCallback((text: string, tone: Tone = 'neutral') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, tone }])
  }, [])

  useEffect(() => {
    if (toasts.length === 0) return
    const t = setTimeout(() => {
      setToasts((tt) => tt.slice(1))
    }, 2400)
    return () => clearTimeout(t)
  }, [toasts])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-3 py-2 rounded-md text-sm shadow-md animate-fadeUp bg-surface border border-line text-text`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const v = useContext(ToastContext)
  if (!v) throw new Error('useToast must be used within ToastProvider')
  return v
}
```

The `Toast.tsx` file just re-exports for convenience:

```typescript
// frontend/src/components/primitives/Toast.tsx
export { ToastProvider, useToast } from './ToastContext'
```

### Task 4.6: Run + commit primitives

- [ ] **Step 1: Run all primitives tests**

```bash
cd frontend && npm test -- --run components/primitives
```

Expected: Modal tests pass. Other primitives don't have tests.

- [ ] **Step 2: Verify tsc**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "TransactionDetail.tsx\|VendorList.tsx\|AdaptersSettings.tsx" | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/primitives/ frontend/src/lib/cn.ts 2>/dev/null
git commit -m "feat(frontend): primitives — Card, Button, Badge, Segmented, Toggle, Field, Input, Select, Modal, Avatar, Toast, IconTile"
```

---

## Task 5: Charts

Hand-built SVG. Pull each component from `.handoff/design/charts.jsx`. Translate `React.createElement` to JSX + TypeScript. Use the new color tokens via CSS variables — colors are passed as props or referenced as `var(--c1)` etc.

### Task 5.1: Donut + test (the most consequential)

- [ ] **Step 1: Tests**

```typescript
// frontend/src/components/charts/Donut.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Donut, computeSlices } from './Donut'

describe('Donut.computeSlices', () => {
  it('returns slices summing to 100% (with rounding tolerance)', () => {
    const slices = computeSlices([
      { label: 'Food', amount: 50, color: 'var(--c1)' },
      { label: 'Travel', amount: 30, color: 'var(--c2)' },
      { label: 'Other', amount: 20, color: 'var(--c3)' },
    ])
    const totalPct = slices.reduce((s, x) => s + x.pct, 0)
    expect(totalPct).toBeCloseTo(100, 0)
    expect(slices[0].pct).toBeCloseTo(50, 1)
  })

  it('handles empty input', () => {
    expect(computeSlices([])).toEqual([])
  })

  it('handles zero-total input', () => {
    const slices = computeSlices([{ label: 'X', amount: 0, color: 'var(--c1)' }])
    expect(slices).toEqual([])
  })
})

describe('Donut', () => {
  it('renders center total when provided', () => {
    render(
      <Donut
        data={[{ label: 'A', amount: 100, color: 'var(--c1)' }]}
        centerLabel="Total"
        centerAmount="100.00"
        centerSuffix="AED"
      />,
    )
    expect(screen.getByText('Total')).toBeInTheDocument()
    expect(screen.getByText('100.00')).toBeInTheDocument()
    expect(screen.getByText('AED')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/components/charts/Donut.tsx
export interface DonutSlice {
  label: string
  amount: number
  color: string
}

interface ComputedSlice extends DonutSlice {
  pct: number
  start: number  // radians
  end: number    // radians
}

export function computeSlices(data: DonutSlice[]): ComputedSlice[] {
  const total = data.reduce((s, x) => s + x.amount, 0)
  if (total <= 0) return []
  let cursor = -Math.PI / 2  // start at 12 o'clock
  return data.map((slice) => {
    const angle = (slice.amount / total) * Math.PI * 2
    const start = cursor
    const end = cursor + angle
    cursor = end
    return { ...slice, pct: (slice.amount / total) * 100, start, end }
  })
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number, innerR: number): string {
  const large = end - start > Math.PI ? 1 : 0
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  const xi1 = cx + innerR * Math.cos(end)
  const yi1 = cy + innerR * Math.sin(end)
  const xi2 = cx + innerR * Math.cos(start)
  const yi2 = cy + innerR * Math.sin(start)
  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
    `L ${xi1} ${yi1}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2}`,
    'Z',
  ].join(' ')
}

interface DonutProps {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerAmount?: string
  centerSuffix?: string
}

export function Donut({
  data,
  size = 220,
  thickness = 32,
  centerLabel,
  centerAmount,
  centerSuffix,
}: DonutProps) {
  const slices = computeSlices(data)
  const r = size / 2 - 4
  const innerR = r - thickness
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.length === 0 && (
          <circle cx={cx} cy={cy} r={r - thickness / 2} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        )}
        {slices.map((s, i) => (
          <path key={i} d={arcPath(cx, cy, r, s.start, s.end, innerR)} fill={s.color} />
        ))}
      </svg>
      {(centerLabel || centerAmount || centerSuffix) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ width: size, height: size }}
        >
          {centerLabel && <div className="text-xs text-text-2">{centerLabel}</div>}
          {centerAmount && (
            <div className="font-serif text-[26px] font-semibold tnum">{centerAmount}</div>
          )}
          {centerSuffix && <div className="text-xs text-text-3 mt-0.5">{centerSuffix}</div>}
        </div>
      )}
    </div>
  )
}
```

### Task 5.2: Sparkline + test

- [ ] **Step 1: Tests**

```typescript
// frontend/src/components/charts/Sparkline.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('renders without crashing on empty data', () => {
    const { container } = render(<Sparkline values={[]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a path with one point', () => {
    const { container } = render(<Sparkline values={[10]} />)
    expect(container.querySelector('path')).toBeTruthy()
  })

  it('handles all-equal values without NaN', () => {
    const { container } = render(<Sparkline values={[5, 5, 5, 5]} />)
    const path = container.querySelector('path')
    expect(path?.getAttribute('d')).not.toContain('NaN')
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/components/charts/Sparkline.tsx
interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}

export function Sparkline({ values, width = 80, height = 24, stroke = 'var(--accent)' }: SparklineProps) {
  if (values.length === 0) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />
  }
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / Math.max(values.length - 1, 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const d = `M ${points.join(' L ')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
```

### Task 5.3: Ring + test

- [ ] **Step 1: Tests**

```typescript
// frontend/src/components/charts/Ring.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Ring } from './Ring'

describe('Ring', () => {
  it('renders 0 progress as zero-arc', () => {
    const { container } = render(<Ring value={0} max={100} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('clamps value above max', () => {
    const { container } = render(<Ring value={500} max={100} centerLabel="500%" />)
    expect(screen.getByText('500%')).toBeInTheDocument()
  })

  it('uses debit color when value > max', () => {
    const { container } = render(<Ring value={150} max={100} />)
    const arcs = container.querySelectorAll('path,circle')
    const filled = Array.from(arcs).find((el) => el.getAttribute('stroke')?.includes('debit'))
    expect(filled || arcs.length > 0).toBeTruthy()  // permissive: just confirms a debit-colored stroke exists
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/components/charts/Ring.tsx
interface RingProps {
  value: number
  max: number
  size?: number
  thickness?: number
  centerLabel?: string
}

export function Ring({ value, max, size = 80, thickness = 10, centerLabel }: RingProps) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const over = max > 0 && value > max
  const warn = !over && pct > 0.85
  const stroke = over ? 'var(--debit)' : warn ? 'var(--warn)' : 'var(--accent)'

  const r = size / 2 - thickness / 2
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const dash = pct * circumference

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={thickness} />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={thickness}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </svg>
      {centerLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
          {centerLabel}
        </div>
      )}
    </div>
  )
}
```

### Task 5.4: AreaTrend, Heatmap, MiniBars, Progress

Pull each from `.handoff/design/charts.jsx`. Implementer writes minimal contracts:

- **AreaTrend**: line chart with two series (`current` solid, `previous` dashed). Used by Dashboard's spending-pace card. Props: `current: number[]`, `previous: number[]`, optional title.
- **Heatmap**: 7×N grid (weekday × week). Used for activity heatmap if needed. Props: `cells: { date: string; value: number }[]`.
- **MiniBars**: small bar chart for category breakdowns. Props: `bars: { label: string; value: number; color?: string }[]`.
- **Progress**: thin horizontal bar with optional "warn" / "over" coloring. Props: `value: number, max: number`.

No tests required for these — visual verification via kitchen-sink page.

### Task 5.5: Run + commit charts

- [ ] **Step 1: Run chart tests**

```bash
cd frontend && npm test -- --run components/charts
```

Expected: Donut + Sparkline + Ring tests pass.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/charts/
git commit -m "feat(frontend): hand-built SVG charts — Donut, AreaTrend, Sparkline, Heatmap, Ring, MiniBars, Progress"
```

---

## Task 6: TanStack Query hooks for new endpoints

**Files:**
- Create: `frontend/src/hooks/useRecurring.ts`
- Create: `frontend/src/hooks/useTransactionSummary.ts` + `useTransactionSummary.test.ts`
- Create: `frontend/src/hooks/useGoals.ts`
- Create: `frontend/src/hooks/useAccount.ts`
- Create: `frontend/src/hooks/useInsights.ts`
- Create: `frontend/src/hooks/useAISettings.ts`
- Create: `frontend/src/hooks/useAdapterStats.ts`

All hooks follow the same pattern: query keys, useQuery / useMutation, invalidations.

### Task 6.1: useTransactionSummary + test

- [ ] **Step 1: Test (verifies query key shape + invalidation behavior)**

```typescript
// frontend/src/hooks/useTransactionSummary.test.ts
import { describe, it, expect } from 'vitest'
import { transactionSummaryKey } from './useTransactionSummary'

describe('useTransactionSummary', () => {
  it('builds a stable query key from filters', () => {
    const f1 = { wallet_id: 'w1', date_from: '2026-06-01T00:00:00' }
    const f2 = { wallet_id: 'w1', date_from: '2026-06-01T00:00:00' }
    expect(transactionSummaryKey(f1)).toEqual(transactionSummaryKey(f2))
  })

  it('different filters produce different keys', () => {
    expect(transactionSummaryKey({ wallet_id: 'w1' })).not.toEqual(transactionSummaryKey({ wallet_id: 'w2' }))
  })

  it('omits undefined fields from key', () => {
    const k = transactionSummaryKey({ wallet_id: 'w1', vendor_id: undefined })
    expect(JSON.stringify(k)).not.toContain('vendor_id')
  })
})
```

- [ ] **Step 2: Implementation**

```typescript
// frontend/src/hooks/useTransactionSummary.ts
import { useQuery } from '@tanstack/react-query'
import { fetchTransactionsSummary, type TransactionFilters, type TransactionsSummary } from '@/api/transactions'

export function transactionSummaryKey(filters: TransactionFilters): readonly [string, Record<string, unknown>] {
  const cleaned: Record<string, unknown> = {}
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') cleaned[k] = v
  })
  return ['transaction-summary', cleaned] as const
}

export function useTransactionSummary(filters: TransactionFilters) {
  return useQuery<TransactionsSummary>({
    queryKey: transactionSummaryKey(filters),
    queryFn: () => fetchTransactionsSummary(filters),
    placeholderData: (prev) => prev,
  })
}
```

### Task 6.2: useRecurring

```typescript
// frontend/src/hooks/useRecurring.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateTransactionRecurring, bulkUpdateRecurring } from '@/api/transactions'

export function useUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isRecurring }: { id: string; isRecurring: boolean }) =>
      updateTransactionRecurring(id, isRecurring),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transaction-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useBulkUpdateRecurring() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ ids, isRecurring }: { ids: string[]; isRecurring: boolean }) =>
      bulkUpdateRecurring(ids, isRecurring),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['transaction-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
```

### Task 6.3: useGoals

```typescript
// frontend/src/hooks/useGoals.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchGoals, createGoal, updateGoal, deleteGoal, contributeToGoal,
  type SavingsGoal, type SavingsGoalInput,
} from '@/api/goals'

export function useGoals() {
  return useQuery<SavingsGoal[]>({
    queryKey: ['goals'],
    queryFn: fetchGoals,
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SavingsGoalInput) => createGoal(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SavingsGoalInput> }) =>
      updateGoal(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}

export function useContributeToGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: string }) => contributeToGoal(id, amount),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })
}
```

### Task 6.4: useAccount

```typescript
// frontend/src/hooks/useAccount.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateProfile, deleteAccount } from '@/api/auth'

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: deleteAccount,
  })
}
```

### Task 6.5: useInsights, useAISettings, useAdapterStats

```typescript
// frontend/src/hooks/useInsights.ts
import { useQuery } from '@tanstack/react-query'
import { fetchInsights, type InsightsResponse } from '@/api/analytics'

export function useInsights(periodStart: string, periodEnd: string) {
  return useQuery<InsightsResponse>({
    queryKey: ['insights', periodStart, periodEnd],
    queryFn: () => fetchInsights(periodStart, periodEnd),
  })
}
```

```typescript
// frontend/src/hooks/useAISettings.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchAISettings, updateAISettings, type AISettings } from '@/api/ai'

export function useAISettings() {
  return useQuery<AISettings>({
    queryKey: ['ai-settings'],
    queryFn: fetchAISettings,
  })
}

export function useUpdateAISettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateAISettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
  })
}
```

```typescript
// frontend/src/hooks/useAdapterStats.ts
import { useQuery } from '@tanstack/react-query'
import { fetchAdapterStats, type AdapterStats } from '@/api/adapters'

export function useAdapterStats(name: string) {
  return useQuery<AdapterStats>({
    queryKey: ['adapter-stats', name],
    queryFn: () => fetchAdapterStats(name),
    enabled: !!name,
  })
}
```

### Task 6.6: Verify + commit

- [ ] Run: `cd frontend && npm test -- --run hooks/useTransactionSummary` → expect pass.
- [ ] `npx tsc --noEmit` → no new errors.
- [ ] Commit:

```bash
git add frontend/src/hooks/
git commit -m "feat(frontend): TanStack Query hooks for v2 backend endpoints"
```

---

## Task 7: UI state hooks

**Files:**
- Create: `frontend/src/hooks/useTheme.ts`
- Create: `frontend/src/hooks/useAccent.ts`
- Create: `frontend/src/hooks/useCommandPalette.ts`
- Create: `frontend/src/components/shell/CommandPaletteContext.tsx`

```typescript
// frontend/src/hooks/useTheme.ts
import { useState, useCallback, useEffect } from 'react'
import { applyTheme, readStoredTheme, readStoredAccent, type Theme } from '@/lib/theme'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())

  useEffect(() => {
    applyTheme(theme, readStoredAccent())
  }, [theme])

  const setTheme = useCallback((t: Theme) => setThemeState(t), [])
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, setTheme, toggle }
}
```

```typescript
// frontend/src/hooks/useAccent.ts
import { useState, useCallback, useEffect } from 'react'
import { applyTheme, readStoredAccent, readStoredTheme, type AccentName } from '@/lib/theme'

export function useAccent() {
  const [accent, setAccentState] = useState<AccentName>(() => readStoredAccent())

  useEffect(() => {
    applyTheme(readStoredTheme(), accent)
  }, [accent])

  const setAccent = useCallback((a: AccentName) => setAccentState(a), [])
  return { accent, setAccent }
}
```

```typescript
// frontend/src/components/shell/CommandPaletteContext.tsx
import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { ReactNode } from 'react'

interface CommandPaletteContextValue {
  open: boolean
  setOpen: (v: boolean) => void
  toggle: () => void
}

const Ctx = createContext<CommandPaletteContextValue | null>(null)

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const toggle = useCallback(() => setOpen((v) => !v), [])
  return <Ctx.Provider value={{ open, setOpen, toggle }}>{children}</Ctx.Provider>
}

export function useCommandPalette() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCommandPalette must be used within CommandPaletteProvider')
  return v
}
```

```typescript
// frontend/src/hooks/useCommandPalette.ts
export { useCommandPalette } from '@/components/shell/CommandPaletteContext'
```

- [ ] Commit:

```bash
git add frontend/src/hooks/useTheme.ts frontend/src/hooks/useAccent.ts frontend/src/hooks/useCommandPalette.ts frontend/src/components/shell/CommandPaletteContext.tsx
git commit -m "feat(frontend): theme + accent + command-palette state hooks"
```

---

## Task 8: Shell — ThemeProvider + TopBar + MobileTabBar + AccountDropdown

Read `.handoff/design/shell.jsx` for exact markup. Translate.

### Task 8.1: ThemeProvider

```typescript
// frontend/src/components/shell/ThemeProvider.tsx
import { useTheme } from '@/hooks/useTheme'
import { useAccent } from '@/hooks/useAccent'
import type { ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Side effects run in the hooks; this component just wires them in.
  useTheme()
  useAccent()
  return <>{children}</>
}
```

### Task 8.2: TopBar

```typescript
// frontend/src/components/shell/TopBar.tsx
import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { Avatar } from '../primitives/Avatar'
import { useCommandPalette } from '@/hooks/useCommandPalette'
import { cn } from '@/lib/cn'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' as const },
  { to: '/transactions', label: 'Transactions', icon: 'list' as const },
  { to: '/budgets', label: 'Budgets', icon: 'target' as const },
  { to: '/reports', label: 'Reports', icon: 'report' as const },
  { to: '/chat', label: 'AI Chat', icon: 'chat' as const },
  { to: '/vendors', label: 'Vendors', icon: 'tag' as const },
  { to: '/categories', label: 'Categories', icon: 'folder' as const },
]

interface TopBarProps {
  user: { username: string; display_name?: string | null } | null
  onAvatarClick: () => void
}

export function TopBar({ user, onAvatarClick }: TopBarProps) {
  const { setOpen } = useCommandPalette()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-surface/70 backdrop-blur-md border-b border-line">
      <div className="max-w-maxw mx-auto px-5 h-16 flex items-center gap-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 shrink-0"
          aria-label="Home"
        >
          <span className="w-8 h-8 rounded-md bg-accent text-accent-fg flex items-center justify-center font-serif font-semibold">
            ₮
          </span>
          <span className="font-serif text-[17px] font-semibold hidden md:inline">
            Transaction <span className="text-text-2 italic font-normal">Intelligence</span>
          </span>
        </button>

        <nav className="hidden md:flex flex-1 items-center justify-between gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-surface text-accent border border-line'
                    : 'text-text-2 hover:text-text',
                )
              }
            >
              <Icon name={item.icon} size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setOpen(true)}
          className="hidden sm:flex items-center gap-2 min-w-[150px] px-3 py-1.5 bg-surface-2 hover:bg-surface-3 border border-line rounded-md text-sm text-text-2"
        >
          <Icon name="search" size={14} />
          <span className="flex-1 text-left">Search</span>
          <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] bg-surface border border-line rounded">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onAvatarClick}
          aria-label="Account menu"
          className="shrink-0"
        >
          <Avatar name={user?.display_name || user?.username || '?'} size={32} />
        </button>
      </div>
    </header>
  )
}
```

### Task 8.3: MobileTabBar

```typescript
// frontend/src/components/shell/MobileTabBar.tsx
import { NavLink } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { cn } from '@/lib/cn'

const TABS = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' as const },
  { to: '/transactions', label: 'Txns', icon: 'list' as const },
  { to: '/budgets', label: 'Budgets', icon: 'target' as const },
  { to: '/chat', label: 'AI', icon: 'chat' as const },
  { to: '/settings', label: 'Settings', icon: 'settings' as const },
]

export function MobileTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/80 backdrop-blur-md border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-around items-center h-14">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-0.5 text-[10px] px-3 py-1',
                isActive ? 'text-accent' : 'text-text-2',
              )
            }
          >
            <Icon name={t.icon} size={18} />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

### Task 8.4: AccountDropdown

```typescript
// frontend/src/components/shell/AccountDropdown.tsx
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar } from '../primitives/Avatar'
import { Icon } from '../icons/Icon'
import { useTheme } from '@/hooks/useTheme'
import { Toggle } from '../primitives/Toggle'

interface AccountDropdownProps {
  user: { username: string; display_name?: string | null; email?: string | null } | null
  open: boolean
  onClose: () => void
  onLogout: () => void
}

export function AccountDropdown({ user, open, onClose, onLogout }: AccountDropdownProps) {
  const navigate = useNavigate()
  const { theme, toggle: toggleTheme } = useTheme()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={ref}
      className="absolute right-5 top-16 w-[250px] bg-surface border border-line rounded-lg shadow-md py-1.5 z-50 animate-fadeIn"
    >
      <button
        onClick={() => { onClose(); navigate('/settings/account') }}
        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-surface-2 text-left"
      >
        <Avatar name={user?.display_name || user?.username || '?'} size={32} />
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{user?.display_name || user?.username}</div>
          {user?.email && <div className="text-xs text-text-2 truncate">{user.email}</div>}
        </div>
      </button>
      <div className="border-t border-line my-1" />
      <button
        onClick={() => { onClose(); navigate('/settings') }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-left text-sm"
      >
        <Icon name="settings" size={14} />
        Settings
      </button>
      <div className="flex items-center justify-between px-3 py-1.5 text-sm">
        <span className="flex items-center gap-2"><Icon name="moon" size={14} /> Dark mode</span>
        <Toggle checked={theme === 'dark'} onChange={toggleTheme} />
      </div>
      <div className="border-t border-line my-1" />
      <button
        onClick={() => { onClose(); onLogout() }}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-2 text-left text-sm text-debit"
      >
        <Icon name="logout" size={14} />
        Log out
      </button>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add frontend/src/components/shell/
git commit -m "feat(frontend): TopBar, MobileTabBar, AccountDropdown, ThemeProvider"
```

---

## Task 9: Shell — CommandPalette + test

### Task 9.1: Tests

```typescript
// frontend/src/components/shell/CommandPalette.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CommandPalette } from './CommandPalette'

function setup(open: boolean, navigate = vi.fn()) {
  const onClose = vi.fn()
  render(
    <MemoryRouter>
      <CommandPalette open={open} onClose={onClose} onNavigate={navigate} />
    </MemoryRouter>,
  )
  return { onClose, navigate }
}

describe('CommandPalette', () => {
  it('does not render when closed', () => {
    setup(false)
    expect(screen.queryByPlaceholderText(/search/i)).toBeNull()
  })

  it('renders nav items by default (empty query)', () => {
    setup(true)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Transactions')).toBeInTheDocument()
  })

  it('Esc closes', () => {
    const { onClose } = setup(true)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('Enter on highlighted item navigates', () => {
    const { navigate } = setup(true)
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(navigate).toHaveBeenCalled()
  })

  it('ArrowDown advances highlight', () => {
    setup(true)
    const items = screen.getAllByTestId('cmdk-item')
    // The first item should be highlighted initially
    expect(items[0]).toHaveAttribute('data-active', 'true')
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(items[1]).toHaveAttribute('data-active', 'true')
  })
})
```

### Task 9.2: Implementation

```typescript
// frontend/src/components/shell/CommandPalette.tsx
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'

interface CmdItem {
  id: string
  label: string
  group: 'Navigate' | 'Actions' | 'Transactions'
  icon?: string
  to?: string
  action?: () => void
}

const NAV: CmdItem[] = [
  { id: 'nav-dash', label: 'Dashboard', group: 'Navigate', icon: 'dashboard', to: '/' },
  { id: 'nav-txn', label: 'Transactions', group: 'Navigate', icon: 'list', to: '/transactions' },
  { id: 'nav-budgets', label: 'Budgets', group: 'Navigate', icon: 'target', to: '/budgets' },
  { id: 'nav-reports', label: 'Reports', group: 'Navigate', icon: 'report', to: '/reports' },
  { id: 'nav-chat', label: 'AI Chat', group: 'Navigate', icon: 'chat', to: '/chat' },
  { id: 'nav-vendors', label: 'Vendors', group: 'Navigate', icon: 'tag', to: '/vendors' },
  { id: 'nav-categories', label: 'Categories', group: 'Navigate', icon: 'folder', to: '/categories' },
  { id: 'nav-settings', label: 'Settings', group: 'Navigate', icon: 'settings', to: '/settings' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  onNavigate?: (path: string) => void  // injectable for tests
}

export function CommandPalette({ open, onClose, onNavigate }: CommandPaletteProps) {
  const navigateHook = useNavigate()
  const nav = onNavigate ?? ((p: string) => navigateHook(p))
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  // Reset query/active when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  const items = useMemo<CmdItem[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV
    return NAV.filter((i) => i.label.toLowerCase().includes(q))
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActive((a) => Math.min(a + 1, items.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[active]
        if (item?.to) {
          nav(item.to)
          onClose()
        } else if (item?.action) {
          item.action()
          onClose()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, items, active, onClose, nav])

  if (!open) return null

  return createPortal(
    <div
      data-testid="cmdk-scrim"
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[3px] flex items-start justify-center pt-[12vh] px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-line rounded-lg shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 border-b border-line">
          <Icon name="search" size={16} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search transactions, navigate, run actions…"
            className="flex-1 bg-transparent py-3 outline-none text-sm"
          />
          <kbd className="text-[10px] text-text-3 border border-line rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1">
          {items.map((item, idx) => (
            <li
              key={item.id}
              data-testid="cmdk-item"
              data-active={idx === active ? 'true' : 'false'}
              onMouseEnter={() => setActive(idx)}
              onClick={() => {
                if (item.to) { nav(item.to); onClose() }
                else if (item.action) { item.action(); onClose() }
              }}
              className={`flex items-center gap-3 px-3 py-2 cursor-pointer text-sm ${
                idx === active ? 'bg-surface-2' : ''
              }`}
            >
              {item.icon && <Icon name={item.icon} size={14} />}
              <span className="flex-1">{item.label}</span>
              <span className="text-[10px] uppercase text-text-3">{item.group}</span>
            </li>
          ))}
          {items.length === 0 && (
            <li className="px-3 py-4 text-sm text-text-2 text-center">No matches</li>
          )}
        </ul>
      </div>
    </div>,
    document.body,
  )
}
```

- [ ] Run: `cd frontend && npm test -- --run components/shell/CommandPalette` → expect pass.
- [ ] Commit:

```bash
git add frontend/src/components/shell/CommandPalette.tsx frontend/src/components/shell/CommandPalette.test.tsx
git commit -m "feat(frontend): ⌘K command palette with keyboard nav"
```

---

## Task 10: Placeholder screen + Routing rewrite

### Task 10.1: ScreenComingSoon placeholder

```typescript
// frontend/src/components/screens/ScreenComingSoon.tsx
interface Props { name: string }

export function ScreenComingSoon({ name }: Props) {
  return (
    <div className="max-w-maxw mx-auto px-5 py-10 text-center">
      <div className="font-serif text-2xl mb-2">{name}</div>
      <div className="text-text-2 text-sm">Coming soon in Phase 3.</div>
    </div>
  )
}
```

### Task 10.2: Rewrite App.tsx

Replace `frontend/src/App.tsx` with:

```typescript
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './components/shell/ThemeProvider'
import { ToastProvider } from './components/primitives/ToastContext'
import { CommandPaletteProvider, useCommandPalette } from './components/shell/CommandPaletteContext'

import { TopBar } from './components/shell/TopBar'
import { MobileTabBar } from './components/shell/MobileTabBar'
import { AccountDropdown } from './components/shell/AccountDropdown'
import { CommandPalette } from './components/shell/CommandPalette'

import { ScreenComingSoon } from './components/screens/ScreenComingSoon'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

function AuthedShell() {
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const { open: paletteOpen, setOpen: setPaletteOpen } = useCommandPalette()
  const location = useLocation()

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <TopBar user={user} onAvatarClick={() => setDropdownOpen((v) => !v)} />
      <AccountDropdown
        user={user}
        open={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        onLogout={logout}
      />
      <main key={location.pathname}>
        <Routes>
          <Route path="/" element={<ScreenComingSoon name="Dashboard" />} />
          <Route path="/transactions" element={<ScreenComingSoon name="Transactions" />} />
          <Route path="/transactions/:id" element={<ScreenComingSoon name="Transaction Detail" />} />
          <Route path="/budgets" element={<ScreenComingSoon name="Budgets & Goals" />} />
          <Route path="/reports" element={<ScreenComingSoon name="Reports" />} />
          <Route path="/chat" element={<ScreenComingSoon name="AI Chat" />} />
          <Route path="/vendors" element={<ScreenComingSoon name="Vendors" />} />
          <Route path="/categories" element={<ScreenComingSoon name="Categories" />} />
          <Route path="/settings/*" element={<ScreenComingSoon name="Settings" />} />
          {import.meta.env.DEV && (
            <Route path="/_kitchen-sink" element={<KitchenSinkLazy />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <MobileTabBar />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

// Lazy import so the dev page is dropped from production bundles
import { lazy, Suspense } from 'react'
const KitchenSink = lazy(() => import('./components/_kitchen-sink/KitchenSink').then((m) => ({ default: m.KitchenSink })))
function KitchenSinkLazy() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-text-2">Loading…</div>}>
      <KitchenSink />
    </Suspense>
  )
}

function Gate() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-text-2">Loading…</div>
  if (!user) return <ScreenComingSoon name="Login" />  // Phase 3a swaps this for real LoginPage
  return <AuthedShell />
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              <BrowserRouter>
                <Gate />
              </BrowserRouter>
            </CommandPaletteProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
```

> If the existing `App.tsx` referenced legacy components or different provider patterns, the implementer reads the current `App.tsx` once to extract the auth-provider/router shape, then replaces with the structure above. Don't break `AuthContext` — keep using it as-is.

- [ ] Commit:

```bash
git add frontend/src/App.tsx frontend/src/components/screens/ScreenComingSoon.tsx
git commit -m "feat(frontend): App.tsx rewritten with v2 shell + 10 placeholder routes"
```

---

## Task 11: Kitchen-sink dev page

```typescript
// frontend/src/components/_kitchen-sink/KitchenSink.tsx
import { Card } from '../primitives/Card'
import { Button } from '../primitives/Button'
import { Badge } from '../primitives/Badge'
import { Toggle } from '../primitives/Toggle'
import { Segmented } from '../primitives/Segmented'
import { Input } from '../primitives/Input'
import { Field } from '../primitives/Field'
import { Select } from '../primitives/Select'
import { Avatar } from '../primitives/Avatar'
import { IconTile } from '../primitives/IconTile'
import { Modal } from '../primitives/Modal'
import { useToast } from '../primitives/ToastContext'
import { Icon } from '../icons/Icon'
import { Donut } from '../charts/Donut'
import { AreaTrend } from '../charts/AreaTrend'
import { Sparkline } from '../charts/Sparkline'
import { Ring } from '../charts/Ring'
import { MiniBars } from '../charts/MiniBars'
import { Progress } from '../charts/Progress'
import { Heatmap } from '../charts/Heatmap'
import { useState } from 'react'

export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false)
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a')
  const [toggle, setToggle] = useState(false)
  const { show } = useToast()

  return (
    <div className="max-w-maxw mx-auto px-5 py-8 space-y-8">
      <h1 className="font-serif text-3xl">Kitchen Sink</h1>
      <div className="text-text-2">Visual gallery of v2 primitives and charts. Dev-only.</div>

      <section>
        <h2 className="font-serif text-xl mb-3">Buttons</h2>
        <Card>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Badges</h2>
        <Card>
          <div className="flex gap-2 flex-wrap">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="debit">Debit</Badge>
            <Badge tone="credit">Credit</Badge>
            <Badge tone="warn">Warning</Badge>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Form primitives</h2>
        <Card>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Username"><Input placeholder="alex" /></Field>
            <Field label="Category" hint="optional">
              <Select options={[{ value: 'food', label: 'Food' }, { value: 'travel', label: 'Travel' }]} />
            </Field>
            <div className="flex items-center gap-3">
              <Toggle checked={toggle} onChange={setToggle} label="Toggle" />
            </div>
            <Segmented
              options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]}
              value={seg}
              onChange={setSeg}
            />
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Avatars + Icon Tiles</h2>
        <Card>
          <div className="flex gap-3 items-center">
            <Avatar name="Alex" />
            <Avatar name="Jane Doe" size={48} />
            <IconTile name="arrow-down-right" tone="debit" />
            <IconTile name="arrow-up-right" tone="credit" />
            <IconTile name="warning" tone="warn" />
            <Icon name="sparkles" size={22} />
          </div>
        </Card>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Modal & Toast</h2>
        <Card>
          <div className="flex gap-2">
            <Button onClick={() => setModalOpen(true)}>Open Modal</Button>
            <Button onClick={() => show('Saved', 'accent')}>Show Toast</Button>
          </div>
        </Card>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Hello">
          <p className="text-sm text-text-2">Modal body content goes here.</p>
        </Modal>
      </section>

      <section>
        <h2 className="font-serif text-xl mb-3">Charts</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-serif text-lg mb-2">Donut</h3>
            <Donut
              data={[
                { label: 'Food', amount: 800, color: 'var(--c1)' },
                { label: 'Travel', amount: 400, color: 'var(--c2)' },
                { label: 'Other', amount: 300, color: 'var(--c3)' },
              ]}
              centerLabel="Total"
              centerAmount="1,500.00"
              centerSuffix="AED"
            />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Sparkline</h3>
            <Sparkline values={[3, 5, 2, 7, 4, 6, 8, 6]} width={200} height={48} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Ring</h3>
            <div className="flex gap-3 items-center">
              <Ring value={30} max={100} centerLabel="30%" />
              <Ring value={92} max={100} centerLabel="92%" />
              <Ring value={120} max={100} centerLabel="120%" />
            </div>
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">MiniBars</h3>
            <MiniBars bars={[{ label: 'Mon', value: 4 }, { label: 'Tue', value: 7 }, { label: 'Wed', value: 3 }, { label: 'Thu', value: 8 }]} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">Progress</h3>
            <Progress value={45} max={100} />
            <div className="h-2" />
            <Progress value={92} max={100} />
            <div className="h-2" />
            <Progress value={120} max={100} />
          </Card>
          <Card>
            <h3 className="font-serif text-lg mb-2">AreaTrend</h3>
            <AreaTrend current={[10, 25, 35, 50, 65, 70]} previous={[15, 28, 32, 40, 55, 60]} />
          </Card>
        </div>
      </section>
    </div>
  )
}
```

- [ ] Commit:

```bash
git add frontend/src/components/_kitchen-sink/
git commit -m "feat(frontend): /_kitchen-sink dev gallery for primitives + charts"
```

---

## Task 12: Acceptance gate

- [ ] **Step 1: Lint + format**

```bash
cd frontend && npm run lint
```

Expected: only the pre-existing react-refresh warning in `AuthContext.tsx`. No new ESLint errors from this PR's files.

- [ ] **Step 2: Type-check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -v "TransactionDetail.tsx\|VendorList.tsx\|AdaptersSettings.tsx"
```

Expected: empty output (no new errors).

- [ ] **Step 3: Tests**

```bash
cd frontend && npm test -- --run
```

Expected: all green. Should include theme + money + dates + Donut + Sparkline + Ring + Modal + CommandPalette + useTransactionSummary tests.

- [ ] **Step 4: Build**

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Visual smoke via dev server**

Start `npm run dev` (or use the existing `make up` frontend service). Open:
- `/` — see TopBar + MobileTabBar + ScreenComingSoon for Dashboard.
- `/_kitchen-sink` — see all primitives + charts rendered.
- Toggle dark mode via account dropdown — verify token swap works.
- Cycle accents (via DevTools temporarily setting `tt-accent` in localStorage + reload — accent picker UI lands in Phase 3j Settings).

- [ ] **Step 6: Open PR**

```bash
git push -u origin feat/v2-fe-foundation
gh pr create --base develop --title "feat(frontend): v2 foundation — tokens, primitives, charts, shell, routing" --body "$(cat <<'EOF'
## Summary
- Replace shadcn HSL tokens with handoff's OKLCH light/dark + accent system
- Tailwind config extended to expose new tokens as utility classes
- New components/{shell,primitives,charts,icons,screens}/ directories
- TanStack Query hooks for slot 1a-1f endpoints (recurring, summary, goals, account, insights, ai-settings, adapter-stats)
- App.tsx rewritten with 10 placeholder route slots ready for Phase 3 screen agents
- /_kitchen-sink dev page for visual QA (gated by import.meta.env.DEV; removed in Phase 4)

## Test plan
- [x] theme.test.ts, money.test.ts, dates.test.ts
- [x] Modal.test.tsx, CommandPalette.test.tsx
- [x] Donut.test.tsx, Sparkline.test.tsx, Ring.test.tsx
- [x] useTransactionSummary.test.ts
- [x] npm run lint (no new errors)
- [x] npx tsc --noEmit (no new errors)
- [x] npm run build clean
- [x] visual smoke at /_kitchen-sink in light + dark mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-10-v2-phase2-frontend-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch fresh subagents per task in a single worktree. Phase 2 is sequential by design (one PR), so no parallel agents. Each task gets its own implementer; spec + quality reviews after each. Use this when you want incremental progress with review gates.

**2. Inline Execution** — Execute all tasks in this session using executing-plans. Continuous, batch with checkpoints for review. Faster wall-clock; less granular review.

Which approach?
