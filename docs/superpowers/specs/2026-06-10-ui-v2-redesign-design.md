# Design Spec — Transaction Intelligence UI v2 Redesign

**Date:** 2026-06-10
**Status:** Approved for planning
**Source handoff:** `~/Downloads/txn v2 handoff.zip` → `design_handoff_transaction_intelligence_ui/`
**Integration branch:** `develop` (staging) → `main` (prod)

---

## 1. Goal

Land the "refined fintech-minimal" UI redesign from the handoff package across the existing React + TS + Vite + Tailwind + TanStack Query frontend, backed by the existing FastAPI service. Phase backend gap-fills before frontend port. Every backend gap from `WIRING.md` is in scope. Use strict TDD on the backend and Vitest tests for logic-bearing frontend pieces.

## 2. Principles

- **Backend first.** No frontend screen lands before the endpoint it consumes.
- **Strict backend TDD.** Red-green-refactor for every new endpoint. Tests against real Postgres via existing fixtures.
- **Pragmatic frontend tests.** Vitest + RTL for logic (hooks, mutations, palette search, filter state, recurring multi-select, summary recompute). No pure snapshot/visual tests.
- **Parallel where safe.** Worktree-isolated agents per backend gap and per UI screen; sequential for the shared frontend foundation.
- **One coherent shell.** Token replacement and shell land in a single sequential PR so the shared layer has one author.
- **Each phase shippable.** Aborting after any phase leaves `main` working.

## 3. Branch & integration model

```
main           ← only via PR from develop after a phase is signed off
  ↑
develop        ← integration / staging; all feat/* branches merge here
  ↑   ↑   ↑   ↑
  └───┴───┴───┴── feat/v2-<phase>-<slot> branches in git worktrees
```

- `develop` already exists; matches `origin/develop`.
- Each parallel agent uses `Agent` tool with `isolation: "worktree"` on a fresh branch off the latest `develop`.
- After each phase, rebase `develop` onto `main` to keep divergence small.
- CI on every PR: backend pytest + ruff + frontend `npm test` + lint + build.
- Existing GitHub workflows auto-deploy from `main` only; `develop` stays out of prod by construction.

## 4. Phase overview

```
Phase 0  Foundations
         ├─ Verify backend test fixtures (Postgres-per-test) exist or add them
         ├─ Confirm develop is rebased on latest main
         └─ Inventory existing tests likely to break under schema changes

Phase 1  Backend gaps  ◀── 7 parallel worktree agents
         ├─ 1a  Recurring transactions
         ├─ 1b  Transactions summary endpoint
         ├─ 1c  Savings goals (new domain)
         ├─ 1d-core  Account profile (display_name, email, prefs, delete)
         ├─ 1d-2fa   2FA + sessions (can land during Phase 3)
         ├─ 1e  Smart insights endpoint
         └─ 1f  AI settings writes + adapter stats

Phase 2  Frontend foundation  ◀── single sequential PR
         ├─ Token replacement (OKLCH light/dark, retire shadcn HSL slots later)
         ├─ Tailwind config extension
         ├─ Shell (top bar, mobile tab bar, account dropdown, ⌘K palette)
         ├─ Theme/accent engine (localStorage, data-theme)
         ├─ Primitives + charts + lucide icon mapping
         ├─ TanStack Query hook layer for new endpoints
         ├─ Routing migration with 10 placeholder route slots
         └─ Kitchen-sink dev page at /_kitchen-sink

Phase 3  Frontend screens  ◀── 10 parallel worktree agents
         3a Login, 3b Dashboard, 3c Transactions, 3d TxnDetail,
         3e Budgets+Goals, 3f Reports, 3g Chat, 3h Vendors+AI,
         3i Categories, 3j Settings

Phase 4  Cutover & cleanup
         ├─ Delete legacy components/*.tsx
         ├─ Drop recharts dep
         ├─ Drop legacy shadcn HSL CSS vars
         ├─ Remove /_kitchen-sink
         ├─ Alembic upgrade↔downgrade round-trip check
         ├─ Full QA across themes/accents/viewports
         └─ develop → main PR, tag v2.0.0
```

## 5. Phase 1 — Backend detail

### Strict TDD discipline (every slot)

```
1. Write failing pytest(s) for the new endpoint behavior
2. Run → confirm RED (assertion failure, not import error)
3. Alembic migration (if needed)
4. Implement route + service + Pydantic schema
5. Run → confirm GREEN
6. Refactor (extract service, dedupe) → tests stay green
7. ruff check + format
8. Open PR to develop
```

### Per-slot contracts

| Slot | Tables | Endpoints | TDD focus |
|---|---|---|---|
| **1a recurring** | `transaction_groups` (+`is_recurring BOOLEAN NOT NULL DEFAULT false`) | extend `PATCH /transactions/{id}` w/ `is_recurring`; new `PATCH /transactions/bulk` `{ids[], is_recurring}`; `?recurring=` on list | single toggle, bulk toggle of N, list filter both directions, dashboard `subscriptions_count` aggregate |
| **1b summary** | none | `GET /transactions/summary` taking same `TransactionFilters` → `{total_debit, total_credit, net, debit_count, credit_count, avg_debit}` | every filter respected, empty-result returns zeros (not nulls), wallet scope honored |
| **1c goals** | new `savings_goals` (`id, user_id, name, target_amount, saved_amount, target_date, color, created_at, updated_at`) | `GET/POST/PATCH/DELETE /goals`, `POST /goals/{id}/contribute` | CRUD, target_date validation, saved_amount monotonicity guard, per-user scoping |
| **1d-core account** | `users` (+`email`, +`preferences JSONB`) | `PATCH /auth/me` (display_name, email, prefs), `DELETE /auth/me` | each route happy + auth + validation; account-delete cascades verified |
| **1d-2fa account** | `users` (+`two_factor_secret`), new `user_sessions` | `POST /auth/2fa/enable`, `POST /auth/2fa/verify`, `DELETE /auth/2fa`, `GET /auth/sessions`, `DELETE /auth/sessions[/{id}]` | TOTP secret generation + verify; session listing + revoke (all + one) |
| **1e insights** | none (computes over existing) | `GET /analytics/insights?period_start=&period_end=` → `{subscriptions_count, top_merchant_alt, budget_forecast, spending_trend}` | each insight type independently; graceful empty-history fallback |
| **1f AI/adapters** | new `app_settings` KV (or extend settings store); add `parser_match_count` on usage log | `PATCH /ai/settings` (URL, model, feature toggles); `GET /adapters/{name}/stats` | settings round-trip; stats compute correctly from message log |

### Parallelism rules

- 1d-core (`users` table) and 1a (`transaction_groups`) target different tables → run truly parallel. Alembic timestamp prefixes prevent filename collisions.
- All slots branch off the same `develop` SHA captured at Phase 1 start.
- After each merge, remaining worktrees `git rebase origin/develop`. Workflow script handles this serially after each merge.
- Each backend PR must also update the corresponding `frontend/src/api/*.ts` types so Phase 2 has a single source of truth.

### Acceptance gate

- All 7 PRs merged (1d-2fa may land in Phase 3 window — see risk register)
- `make test-backend` green
- `make lint-backend` green
- `make db-migrate` applies cleanly against fresh DB; each new migration round-trips upgrade → downgrade → upgrade
- Existing frontend (unmodified) still builds and runs against the new backend — all additions, no removals

## 6. Phase 2 — Frontend foundation detail

Single sequential PR. No parallelism.

### File layout

```
frontend/src/
  styles/
    tokens.css            ← OKLCH light/dark, accent options, motion keyframes
    app.css               ← layout primitives only; rest is Tailwind utilities
  lib/
    theme.ts              ← applyTheme(theme, accent), localStorage persistence
    cn.ts                 ← (existing, kept)
    money.ts              ← fmt.money, fmt.shortMoney, tnum helpers
    dates.ts              ← month nav, period helpers
  components/
    shell/
      TopBar.tsx          ← brand + nav + ⌘K trigger + health dot + avatar
      MobileTabBar.tsx
      AccountDropdown.tsx ← profile, settings, dark toggle, log out
      CommandPalette.tsx
      ThemeProvider.tsx
    primitives/
      Card.tsx · Button.tsx · Badge.tsx · Segmented.tsx · Toggle.tsx
      Field.tsx · Input.tsx · Select.tsx · Modal.tsx · Avatar.tsx
      Toast.tsx · IconTile.tsx
    charts/
      Donut.tsx · AreaTrend.tsx · Sparkline.tsx · Heatmap.tsx
      Ring.tsx · MiniBars.tsx · Progress.tsx
    icons/Icon.tsx         ← lucide-react wrapper keyed by handoff names
  hooks/
    useRecurring.ts useTransactionSummary.ts useGoals.ts
    useAccount.ts useInsights.ts useAISettings.ts useAdapterStats.ts
    useTheme.ts useAccent.ts useCommandPalette.ts
  App.tsx                  ← rewritten router with 10 placeholder slots
```

### Token replacement strategy

1. `index.css` rewritten: `@import` Newsreader + Hanken Grotesk, OKLCH light on `:root`, dark on `[data-theme='dark']`, full token set ported from handoff `tokens.css`.
2. `tailwind.config.js` extended: `colors.bg`, `colors.surface`, `colors.line`, `colors.accent`, `colors.debit`, `colors.credit`, `colors.warn`, plus `c1`..`c8` categorical, all reading `var(--*)`. Radii, shadows, fontFamily serif/sans, `maxWidth.maxw: 1240px`.
3. Old shadcn HSL vars kept temporarily so legacy components in Phase 2 still render; deleted in Phase 4.

### Theme/accent engine

- `data-theme="light"|"dark"` on `<html>`, drop `prefers-color-scheme` opt-in; user toggle persists to `localStorage` (`tt-theme`). Initial value: stored → falls back to system pref on first load.
- 5 accents (Emerald default, Sapphire, Iris, Amber, Terracotta) — set three CSS vars per change, persisted as `tt-accent`.

### Routing

- Keep `react-router-dom` v6. Routes: `/`, `/transactions`, `/transactions/:id`, `/budgets`, `/reports`, `/chat`, `/vendors`, `/categories`, `/settings/*`. `/login` gated by auth context.
- `App.tsx` mounts `ThemeProvider` + `QueryClientProvider` + `AuthProvider` + `ToastProvider` + `CommandPaletteProvider`.

### Tests landing in Phase 2

- `theme.test.ts` — applyTheme persists, reads back, accent override works
- `money.test.ts`, `dates.test.ts` — formatters round-trip
- `CommandPalette.test.tsx` — keyboard nav (↑/↓/↵/Esc), search debounce, action dispatch
- `Donut.test.tsx` — hover-slice computes correct % + amount
- `Sparkline.test.tsx`, `Ring.test.tsx` — edge cases (empty, single point)
- `useTransactionSummary.test.ts` — query key shape, invalidation on filter change

### Acceptance gate

- All foundation tests green
- `npm run build` clean
- `/_kitchen-sink` renders every primitive + chart with mock data
- `npm run lint` + `npm run format:check` green

## 7. Phase 3 — Frontend screens detail

10 worktree agents in parallel (cap = `min(16, cores−2)`; rest queue). Each agent owns one `frontend/src/screens/<Screen>.tsx` plus optional `screens/<Screen>/` subfiles. Shared files are read-only; if an agent needs a new primitive or hook, it stops and emits a structured "needs primitive" report. I batch those into a Phase 2.5 follow-up PR.

### Per-screen contract

| Slot | Screen | Key behavior | Backend it consumes |
|---|---|---|---|
| **3a** | Login | brand mark, 2 fields, sign-in, privacy note | existing `useAuth.login()` |
| **3b** | Dashboard | month nav, 4 stat cards w/ sparklines, Spending pace chart (cumulative this vs last month + verdict pill), By-category donut, Budgets + Top merchants card, AI Insights row | dashboard/categories/top-vendors/budgets/timeseries + `useInsights` (§1e) |
| **3c** | Transactions list | search, filter panel (incl. recurring toggle), active-filter chips, summary bar, day-grouped list, multi-select → mark recurring, pagination | list + `useTransactionSummary` (§1b) + `useRecurring.bulk` (§1a) |
| **3d** | Transaction detail | hero, detail grid (category select, status, wallet, reference, balance after, source), recurring toggle, notes view/edit, evidence cards | existing detail + `useRecurring.toggle` (§1a) |
| **3e** | Budgets & Goals | month nav, total ring, savings goals row (CRUD), category budget grid w/ create modal | existing budgets + `useGoals` (§1c) |
| **3f** | Reports | quick-export tiles, generated reports list, generate modal | existing (all ✅) |
| **3g** | AI Chat | sidebar+main desktop, mobile overlay, bubbles w/ highlights + query_info, suggestion chips, thinking animation | existing (all ✅) |
| **3h** | Vendors + AI | search, AI suggestions toggle, pending banner, accept-all, vendor rows w/ category select, per-vendor suggestion cards | existing (all ✅) |
| **3i** | Categories | tile grid, new-category modal | existing (all ✅) |
| **3j** | Settings | 4 tabs — Account uses §1d, Wallets existing, Adapters existing + §1f stats, AI uses §1f writes | mixed |

### TDD per screen (frontend, Vitest)

Tests authored **before** the screen component, for logic-bearing pieces only:

- **3b** Spending-pace cumulative computation; verdict pill threshold; sparkline derivation from timeseries.
- **3c** Filter→query-key mapping; chip removal updates filter; summary bar reads from `useTransactionSummary` (not page-only sum); multi-select bulk action calls mutation.
- **3d** Recurring toggle calls mutation + invalidates list query; notes save/cancel state machine.
- **3e** Savings goal contribute clamps to target; ring color thresholds (warn >85%, debit >100%).
- **3g** Send composes correct payload (session_id, conversation_history); thinking state during in-flight.
- **3h** Accept-all invalidates pending list; per-vendor "Get AI suggestion" disables button during fetch.
- **3j** Password strength meter logic; danger-zone confirm requires typing username.

Pure-visual presentation: no test; relies on the kitchen-sink page + ad-hoc QA.

### Parallelism rules

- First merge → remaining worktrees rebase on `origin/develop`. Conflicts near-zero because each agent owns a separate `screens/*.tsx` file. Only `App.tsx` is shared; Phase 2 pre-registered all 10 routes with placeholders, so each agent's `App.tsx` diff is a one-line import swap.
- Per-PR review (via `/code-review`): token usage only (no hardcoded hex); no recharts imports; lucide accessed via `<Icon>` wrapper only.

### Acceptance gate

- All 10 screens live; no `<ScreenComingSoon>` remains
- `npm run build` + `npm test` green
- Manual walkthrough: light + dark + 2 accent colors × 360px / 1280px viewports × every screen
- Network tab: all wired endpoints fire; no leftover MOCK data

## 8. Phase 4 — Cutover & cleanup detail

```
1. Delete legacy components/{Dashboard,TransactionList,TransactionDetail,
   BudgetsManager,Reports,Chat,VendorList,CategoriesManager,WalletSettings,
   AdaptersSettings,AISettings,LoginPage}.tsx
   App.test.tsx → replaced by App.v2.test.tsx in Phase 2

2. Drop dependencies
   - recharts (now unused)
   - any shadcn utilities nothing imports

3. Strip legacy CSS vars
   - Remove --background, --foreground, --primary, --secondary, --muted,
     --destructive, --border, --input, --ring, --card, --radius from index.css
   - grep verify no remaining @apply / className references

4. Remove kitchen-sink page

5. Backend tidy
   - make db-migrate fresh-DB end-to-end
   - upgrade head → downgrade -1 → upgrade head round-trip per Phase 1 migration

6. Full QA pass on develop
   - Light + dark + each accent
   - 360px / 768px / 1024px / 1280px viewports
   - Every screen, every modal, every mutation
   - Old SMS/email ingestion still works (regression check)

7. develop → main
   - PR titled "feat: Transaction Intelligence v2 UI redesign"
   - Per-phase squashed history preserved in PR description
   - Tag main as v2.0.0 after merge
```

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| 1d backend scope creep blocks Phase 2 | Medium | Split 1d-core (display_name + email + prefs + delete) from 1d-2fa (2FA + sessions); Phase 2 depends only on 1d-core; 1d-2fa can land alongside Phase 3 |
| Worktree agents drift from each other's API contracts | Low | Each backend agent updates `frontend/src/api/*.ts` types in the same PR |
| Phase 3 agent needs an unexpected primitive mid-flight | Medium | Agents stop and emit "needs primitive" report rather than mutate shared code; batched into Phase 2.5 follow-up PR |
| Token replacement breaks legacy components mid-Phase-3 | High (expected) | Legacy components unreachable from new shell (routes point to new screens or placeholders); deleted in Phase 4 |
| Recurring detector job creeps into 1a | Low | Excluded from 1a; `is_recurring` is set only by user action in v2.0; auto-detection post-v2 |
| Smart insights ship heuristics that look authoritative | Medium | Heuristic insight cards carry an "Estimated" sub-label; only spending-trend (from real `monthly_comparison`) lacks the label |
| Kitchen-sink page leaks to prod | Low | Gated by `import.meta.env.DEV`; deleted in Phase 4 |
| develop diverges from main during rollout | Medium | Rebase `develop` onto `main` at every phase boundary (0→1, 1→2, 2→3, 3→4); hotfixes cherry-picked within 24h |
| User abandons mid-rollout | — | Each phase is independently shippable. After Phase 1, existing UI works against new backend. After Phase 2, app is unusable on `develop` but `main` is untouched. After any Phase 3 PR, that screen works; others show `<ScreenComingSoon>` |

## 10. Out of scope

- Migrating worker / IMAP ingestion
- Recurring auto-detection job
- Email change verification flow (stores new email; verification later)
- Admin features
- i18n
- Full WCAG accessibility audit (focus rings, reduced-motion, semantic HTML — yes; full audit — no)
- Mobile native wrapper
- Multi-user / sharing

## 11. Decision log

- **Backend scope:** All gaps in scope (recurring, summary, goals, account profile, insights, AI/adapter writes). User election.
- **UI rollout:** Foundation PR first, then parallel screens. Recommended; user accepted.
- **TDD scope:** Backend strict, frontend tests for logic-heavy components. Recommended; user accepted.
- **Tokens:** Replace existing shadcn HSL with handoff's full OKLCH set. Recommended; user accepted.
- **Charts:** Port hand-built SVGs as-is; drop recharts. Recommended; user accepted.
- **Integration:** Parallel worktree agents per slot, merging to existing `develop` branch before `main`. User election.
