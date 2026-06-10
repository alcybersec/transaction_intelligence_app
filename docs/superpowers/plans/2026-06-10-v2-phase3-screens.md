# Phase 3 — Frontend Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 10 real screens (Login, Dashboard, Transactions list, Transaction Detail, Budgets & Goals, Reports, AI Chat, Vendors + AI, Categories, Settings) on top of the Phase 2 foundation. Each screen ships as its own worktree-parallel PR to `develop`. After this phase ships, the app is feature-complete on v2 — Phase 4 deletes legacy components and tags v2.0.0.

**Architecture:** Phase 3 Task 0 (sequential, single agent) lands the missing TanStack Query hooks for existing backend endpoints + stubs every screen file so App.tsx can pre-wire all 10 real screen imports. Then Phase 3 Slots 3a–3j (parallel worktree agents) each replace their own screen file. App.tsx is **read-only** for screen agents — they only modify `frontend/src/components/screens/<Screen>.tsx` (and any subfiles under `screens/<Screen>/`).

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind 3.4 (with OKLCH tokens from Phase 2) + TanStack Query v5 + react-router-dom v6. Phase 2 primitives + charts + shell + icon wrapper. Vitest + RTL for logic-bearing tests.

---

## Spec reference

Implements Phase 3 of `docs/superpowers/specs/2026-06-10-ui-v2-redesign-design.md`.

## Handoff reference

Visual source of truth: `.handoff/design/` (gitignored). Each slot points at its specific handoff file. The handoff is React-via-Babel using `React.createElement` and mock data from `.handoff/design/data.js` (`window.MOCK`). Each slot agent translates to JSX + TypeScript and replaces mock reads with the TanStack Query hooks from Task 0.

## Style and naming conventions

- 2-space indent (matches existing).
- Components: PascalCase filenames, named exports.
- Each screen lives at `frontend/src/components/screens/<Screen>.tsx` OR `frontend/src/components/screens/<Screen>/index.tsx` if it has subcomponents (preferred when ≥3 subparts).
- Co-locate tests next to source: `<Screen>.test.tsx` or `<Subpart>.test.tsx`.
- Use `@/lib/cn`, `@/hooks/useX`, `@/components/primitives/X`, `@/components/charts/X`, `@/components/icons/Icon` imports (alias `@` → `src/` already configured in `tsconfig.json` + `vite.config.ts`).
- Money strings come from the API; format with `fmt.money` from `@/lib/money`.
- Dates: ISO strings from the API; format with `new Date(...)` + locale formatting or via helpers in `@/lib/dates`.
- Optimistic UI: prefer TanStack Query's `onMutate` for snappy interactions. Required for Vendors accept/reject (per spec) and for Recurring toggle in Detail.
- Toast feedback for mutations (success + error) via `useToast()`.
- Loading states: lightweight (skeleton bars or "Loading…" text inside the Card). Spinners only for in-flight buttons.
- Empty states: friendly one-liner + (where applicable) a primary CTA.
- Error states: terse, with retry button when reasonable.

## File map

### Created by Task 0 (sequential prep)

Hooks (one file per domain, multiple exported hooks per file):
- `frontend/src/hooks/useTransactions.ts`
- `frontend/src/hooks/useDashboard.ts`
- `frontend/src/hooks/useBudgets.ts`
- `frontend/src/hooks/useReports.ts`
- `frontend/src/hooks/useChat.ts`
- `frontend/src/hooks/useVendors.ts`
- `frontend/src/hooks/useAISuggestions.ts`
- `frontend/src/hooks/useCategories.ts`
- `frontend/src/hooks/useWallets.ts`
- `frontend/src/hooks/useAdapters.ts`
- `frontend/src/hooks/useMe.ts` (wraps `fetchCurrentUser`)

Screen stubs (placeholders, each slot replaces in its branch):
- `frontend/src/components/screens/Login.tsx`
- `frontend/src/components/screens/Dashboard.tsx`
- `frontend/src/components/screens/Transactions.tsx`
- `frontend/src/components/screens/TransactionDetail.tsx`
- `frontend/src/components/screens/Budgets.tsx`
- `frontend/src/components/screens/Reports.tsx`
- `frontend/src/components/screens/Chat.tsx`
- `frontend/src/components/screens/Vendors.tsx`
- `frontend/src/components/screens/Categories.tsx`
- `frontend/src/components/screens/Settings.tsx`

Modified:
- `frontend/src/App.tsx` — import real screens (replacing `ScreenComingSoon` route elements). Auth gate becomes `<Login />` for unauthed users (replacing the `ScreenComingSoon name="Login"`).

### Slot-specific (Task 3a through 3j)

Each slot replaces its stub. Slots with complex screens add a subfolder:
- `screens/Dashboard/` (3b): index.tsx, StatCards.tsx, SpendingPace.tsx, ByCategoryDonut.tsx, BudgetsTopMerchants.tsx, InsightsRow.tsx
- `screens/Transactions/` (3c): index.tsx, FilterPanel.tsx, ActiveFilterChips.tsx, SummaryBar.tsx, TxnList.tsx, MonthNav.tsx (if reused; otherwise inline)
- `screens/Budgets/` (3e): index.tsx, TotalRing.tsx, GoalsRow.tsx, CategoryGrid.tsx, NewBudgetModal.tsx, NewGoalModal.tsx
- `screens/Chat/` (3g): index.tsx, SessionSidebar.tsx, MessageList.tsx, MessageBubble.tsx, Composer.tsx
- `screens/Vendors/` (3h): index.tsx, VendorRow.tsx, SuggestionCard.tsx, PendingBanner.tsx
- `screens/Settings/` (3j): index.tsx, AccountTab.tsx, WalletsTab.tsx, AdaptersTab.tsx, AITab.tsx

Slots with simple screens stay in a single file: 3a Login, 3d TransactionDetail, 3f Reports, 3i Categories.

---

## Universal per-slot worktree contract

Every slot 3a–3j follows the same shape. Read this section once, then each slot section below adds only the slot-specific details.

### Worktree setup

Each slot runs in its own worktree via the Agent tool's `isolation: "worktree"` (one fresh worktree per parallel agent). Inside the worktree:

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app  # or worktree path
git fetch origin
BASE_SHA="$(cat /tmp/v2-phase3-base-sha.txt)"  # post-Task-0 SHA on develop
git checkout -b feat/v2-fe-3<slot>-<name> "$BASE_SHA"
```

`BASE_SHA` is captured at the end of Task 0 (post-hook-scaffold) and shared across all 10 slots.

### Per-slot workflow

1. **Read** the slot's section in this plan for hooks list + tests required + acceptance.
2. **Read** the matching handoff file (e.g., `.handoff/design/screens-dashboard.jsx`) for visual fidelity.
3. **Replace** the stub `frontend/src/components/screens/<Screen>.tsx` with the real implementation.
4. **For complex screens**: factor subcomponents under `screens/<Screen>/` subfolder; rename the stub to `index.tsx` first.
5. **Write tests first** for logic-bearing pieces (each slot calls out what to test).
6. **Use only** Phase 2 primitives, charts, hooks, and Phase 1 endpoints. If you need a primitive that doesn't exist, STOP and report `NEEDS_CONTEXT` — do not mutate shared files.
7. **No App.tsx edits** — Task 0 already wired the import. If your screen needs a new route param, work within the existing route.
8. **Run vitest + tsc + build** clean before opening PR.
9. **Open PR to `develop`** with a slot-specific title.

### Shared files (read-only for slot agents)

- `frontend/src/App.tsx`
- `frontend/src/main.tsx`
- `frontend/src/components/primitives/**`
- `frontend/src/components/charts/**`
- `frontend/src/components/icons/Icon.tsx`
- `frontend/src/components/shell/**`
- `frontend/src/hooks/**` (slot may extend by adding new hooks IF they're truly screen-specific; mutations on cross-screen hooks should already exist from Task 0)
- `frontend/src/styles/tokens.css`
- `frontend/src/lib/**`
- `frontend/src/api/**`

If a slot needs to extend a shared hook file, STOP and report it — controller folds in a Phase 3 follow-up.

### Pre-PR checklist (every slot)

```bash
cd frontend
npm test -- --run
npx tsc --noEmit
npm run build
npm run lint
```

All must be clean. Bundle size delta: aim for <30 KB gzipped per screen.

### PR template (every slot)

```bash
git push -u origin feat/v2-fe-3<slot>-<name>
gh pr create --base develop --title "feat(frontend): <Screen> (3<slot>)" --body "$(cat <<'EOF'
## Summary
- Implements <Screen> per Phase 3 spec section <N>
- Consumes: <hook list>
- Subcomponents: <list if any>
- Tests: <list>

Built on top of Phase 2 foundation; no shared files mutated.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Task 0: Hook scaffold + screen stubs + App.tsx wire-up

**Sequential, single agent. Lands on `develop` BEFORE any slot starts.**

This is the largest task in Phase 3 by line count, but it's mostly mechanical: each hook is a thin TanStack Query wrapper around an existing api/*.ts function.

**Files:**
- Create: 11 hook files (`useTransactions.ts`, `useDashboard.ts`, `useBudgets.ts`, `useReports.ts`, `useChat.ts`, `useVendors.ts`, `useAISuggestions.ts`, `useCategories.ts`, `useWallets.ts`, `useAdapters.ts`, `useMe.ts`)
- Create: 10 screen stubs at `frontend/src/components/screens/<Name>.tsx`
- Modify: `frontend/src/App.tsx` — replace 10 `ScreenComingSoon` route elements with real screen imports

### Worktree setup

```bash
cd /home/alex/Documents/coding/transaction_intelligence_app
git fetch origin
git checkout develop
git pull --ff-only origin develop
git checkout -b feat/v2-fe-3-task0-hooks-and-stubs
```

### Hook design rules

- Every hook file declares its query keys at the top as string constants.
- Mutations call `qc.invalidateQueries({ queryKey: [...] })` on success. Cross-cache invalidation is explicit (e.g., budget mutations invalidate `['budgets']` AND `['budget-summary']`).
- Optimistic updates handled via `onMutate` only where the spec calls for it (Vendors AI accept/reject, Recurring toggle).
- Each hook file exports named hooks: `useFoo`, `useCreateFoo`, etc.
- Re-use Phase 2 query keys where shared:
  - `['transactions', filters]` → useTransactions
  - `['transaction', id]` → useTransaction
  - `['transaction-summary', filters]` → already exists (`useTransactionSummary`)
  - `['dashboard', period, walletId]` → useDashboard
  - `['budgets', month, walletId]` → useBudgets
  - `['budget-summary', month, walletId]` → useBudgetSummary
  - `['reports']` → useReports
  - `['report', id]` → useReport
  - `['chat-sessions']` → useChatSessions
  - `['chat-session', id]` → useChatSession
  - `['vendors', search]` → useVendors
  - `['ai-suggestions', status]` → useAISuggestions (already exists? no — only useAISettings exists from Phase 2; this is new)
  - `['categories']` → useCategories
  - `['wallets']` → useWallets
  - `['instruments']` → useInstruments
  - `['institutions']` → useInstitutions
  - `['adapters']` → useAdapters
  - `['adapter', name]` → useAdapter
  - `['me']` → useMe (already invalidated by Phase 2's `useUpdateProfile`)
  - `['ollama-status']` → useOllamaStatus

### Steps

- [ ] **Step 1: Verify api client coverage**

Before writing hooks, verify each api client function exists. Run:
```bash
grep -nE "^export (async )?function" frontend/src/api/*.ts | sort
```
Cross-reference with the hooks list below. If anything is missing (e.g., the api client for chat exports differently than expected), adjust the hook to match.

Expected api/* clients (from existing code + Phase 1):
- `auth.ts`: login, storeAuth, getStoredTokens, fetchCurrentUser, clearAuth, setupInitialUser, changePassword, updateProfile, deleteAccount (+ 2FA + sessions from 1d-2fa)
- `transactions.ts`: fetchTransactions, fetchTransaction, updateTransactionNotes, updateTransactionCategory, updateTransactionRecurring, bulkUpdateRecurring, fetchTransactionsSummary
- `analytics.ts`: fetchDashboardAnalytics, fetchSpendingTimeSeries, fetchCategoryBreakdown, fetchTopVendors, fetchInsights
- `budgets.ts`: fetchBudgets, fetchBudgetSummary, createBudget, updateBudget, deleteBudget, copyBudgets
- `reports.ts`: fetchReports, fetchReport, generateReport, deleteReport, downloadReportPdf, exportTransactionsCsv, exportCategoriesCsv, exportVendorsCsv, downloadBlob
- `ai.ts`: sendChatMessage, fetchChatSessions, createChatSession, fetchChatSession, deleteChatSession, fetchOllamaStatus, fetchAISettings (new shape), updateAISettings (Phase 1), fetchSuggestions, acceptSuggestion, rejectSuggestion, acceptAllSuggestions, generateSuggestion, categorizeVendor, batchGenerateSuggestions
- `vendors.ts`: fetchVendors, setVendorCategoryRule, deleteVendorCategoryRule
- `categories.ts`: fetchCategories, createCategory, updateCategory, deleteCategory
- `wallets.ts`: fetchWallets, createWallet, updateWallet, deleteWallet, recalculateBalance, fetchInstruments, createInstrument, deleteInstrument, attachInstruments, detachInstruments, fetchInstitutions
- `adapters.ts`: listAdapters, getAdapter, updateAdapterConfig, testPattern, fetchAdapterStats

If a client function name in the actual file doesn't match what the hook below assumes, **use the actual name** and report the deviation.

- [ ] **Step 2: Write `frontend/src/hooks/useTransactions.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchTransactions, fetchTransaction,
  updateTransactionNotes, updateTransactionCategory,
  type Transaction, type TransactionDetail, type TransactionFilters, type TransactionListResponse,
} from '@/api/transactions'

export const transactionsKey = (filters: TransactionFilters = {}) => ['transactions', filters] as const
export const transactionKey = (id: string) => ['transaction', id] as const

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery<TransactionListResponse>({
    queryKey: transactionsKey(filters),
    queryFn: () => fetchTransactions(filters),
    placeholderData: (prev) => prev,
  })
}

export function useTransaction(id: string | undefined, includeBody = true) {
  return useQuery<TransactionDetail>({
    queryKey: id ? transactionKey(id) : ['transaction', 'undefined'],
    queryFn: () => fetchTransaction(id!, includeBody),
    enabled: !!id,
  })
}

export function useUpdateTransactionCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, categoryId }: { id: string; categoryId: string }) =>
      updateTransactionCategory(id, categoryId),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: transactionKey(vars.id) })
      qc.invalidateQueries({ queryKey: ['transaction-summary'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useUpdateTransactionNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string | null }) =>
      updateTransactionNotes(id, notes),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: transactionKey(vars.id) })
    },
  })
}
```

- [ ] **Step 3: Write `frontend/src/hooks/useDashboard.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import {
  fetchDashboardAnalytics, fetchSpendingTimeSeries, fetchCategoryBreakdown, fetchTopVendors,
} from '@/api/analytics'

interface DashboardParams { period_start: string; period_end: string; wallet_id?: string }

export const dashboardKey = (p: DashboardParams) => ['dashboard', p] as const
export const timeseriesKey = (p: DashboardParams) => ['timeseries', p] as const
export const categoryBreakdownKey = (p: DashboardParams) => ['categories-breakdown', p] as const
export const topVendorsKey = (p: DashboardParams) => ['top-vendors', p] as const

export function useDashboard(p: DashboardParams) {
  return useQuery({ queryKey: dashboardKey(p), queryFn: () => fetchDashboardAnalytics(p) })
}

export function useSpendingTimeSeries(p: DashboardParams) {
  return useQuery({ queryKey: timeseriesKey(p), queryFn: () => fetchSpendingTimeSeries(p) })
}

export function useCategoryBreakdown(p: DashboardParams) {
  return useQuery({ queryKey: categoryBreakdownKey(p), queryFn: () => fetchCategoryBreakdown(p) })
}

export function useTopVendors(p: DashboardParams) {
  return useQuery({ queryKey: topVendorsKey(p), queryFn: () => fetchTopVendors(p) })
}
```

- [ ] **Step 4: Write `frontend/src/hooks/useBudgets.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchBudgets, fetchBudgetSummary, createBudget, updateBudget, deleteBudget, copyBudgets,
  type Budget, type BudgetProgress, type BudgetSummary,
} from '@/api/budgets'

interface BudgetsParams { month: string; wallet_id?: string }

export const budgetsKey = (p: BudgetsParams) => ['budgets', p] as const
export const budgetSummaryKey = (p: BudgetsParams) => ['budget-summary', p] as const

export function useBudgets(p: BudgetsParams) {
  return useQuery({ queryKey: budgetsKey(p), queryFn: () => fetchBudgets(p) })
}

export function useBudgetSummary(p: BudgetsParams) {
  return useQuery({ queryKey: budgetSummaryKey(p), queryFn: () => fetchBudgetSummary(p) })
}

interface CreateBudgetInput {
  category_id: string
  month: string
  limit_amount: string
  wallet_id?: string
}

export function useCreateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateBudgetInput) => createBudget(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useUpdateBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateBudgetInput> }) => updateBudget(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useDeleteBudget() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}

export function useCopyBudgets() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sourceMonth, targetMonth }: { sourceMonth: string; targetMonth: string }) =>
      copyBudgets(sourceMonth, targetMonth),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['budget-summary'] })
    },
  })
}
```

- [ ] **Step 5: Write `frontend/src/hooks/useReports.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchReports, fetchReport, generateReport, deleteReport, downloadReportPdf,
  exportTransactionsCsv, exportCategoriesCsv, exportVendorsCsv, downloadBlob,
  type Report, type GenerateReportInput,
} from '@/api/reports'

export const reportsKey = () => ['reports'] as const
export const reportKey = (id: string) => ['report', id] as const

export function useReports() {
  return useQuery({ queryKey: reportsKey(), queryFn: fetchReports })
}

export function useReport(id: string | undefined) {
  return useQuery({
    queryKey: id ? reportKey(id) : ['report', 'undefined'],
    queryFn: () => fetchReport(id!),
    enabled: !!id,
  })
}

export function useGenerateReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: GenerateReportInput) => generateReport(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useDeleteReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports'] }),
  })
}

export function useDownloadReportPdf() {
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const blob = await downloadReportPdf(id)
      downloadBlob(blob, `${name}.pdf`)
    },
  })
}

export function useExportTransactionsCsv() {
  return useMutation({
    mutationFn: async (filters: Parameters<typeof exportTransactionsCsv>[0]) => {
      const blob = await exportTransactionsCsv(filters)
      downloadBlob(blob, `transactions-${new Date().toISOString().slice(0, 10)}.csv`)
    },
  })
}

export function useExportCategoriesCsv() {
  return useMutation({
    mutationFn: async (period: { period_start: string; period_end: string }) => {
      const blob = await exportCategoriesCsv(period)
      downloadBlob(blob, `categories-${period.period_start}-to-${period.period_end}.csv`)
    },
  })
}

export function useExportVendorsCsv() {
  return useMutation({
    mutationFn: async (period: { period_start: string; period_end: string }) => {
      const blob = await exportVendorsCsv(period)
      downloadBlob(blob, `vendors-${period.period_start}-to-${period.period_end}.csv`)
    },
  })
}
```

- [ ] **Step 6: Write `frontend/src/hooks/useChat.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchChatSessions, createChatSession, fetchChatSession, deleteChatSession,
  sendChatMessage, fetchOllamaStatus,
  type ChatSession, type ChatSessionDetail, type ChatResponse,
} from '@/api/ai'

export const chatSessionsKey = () => ['chat-sessions'] as const
export const chatSessionKey = (id: string) => ['chat-session', id] as const
export const ollamaStatusKey = () => ['ollama-status'] as const

export function useChatSessions() {
  return useQuery({ queryKey: chatSessionsKey(), queryFn: fetchChatSessions })
}

export function useChatSession(id: string | undefined) {
  return useQuery({
    queryKey: id ? chatSessionKey(id) : ['chat-session', 'undefined'],
    queryFn: () => fetchChatSession(id!),
    enabled: !!id,
  })
}

export function useCreateChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ title }: { title: string }) => createChatSession(title),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatSessionsKey() }),
  })
}

export function useDeleteChatSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteChatSession(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chatSessionsKey() }),
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: {
      question: string
      session_id?: string
      wallet_id?: string
      conversation_history?: { role: 'user' | 'assistant'; content: string }[]
    }) => sendChatMessage(args),
    onSuccess: (_data, vars) => {
      if (vars.session_id) qc.invalidateQueries({ queryKey: chatSessionKey(vars.session_id) })
      qc.invalidateQueries({ queryKey: chatSessionsKey() })
    },
  })
}

export function useOllamaStatus() {
  return useQuery({
    queryKey: ollamaStatusKey(),
    queryFn: fetchOllamaStatus,
    refetchInterval: 60_000,  // refresh every minute
  })
}
```

- [ ] **Step 7: Write `frontend/src/hooks/useVendors.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchVendors, setVendorCategoryRule, deleteVendorCategoryRule,
  type Vendor,
} from '@/api/vendors'

interface VendorsFilters { search?: string; has_transactions?: boolean }
export const vendorsKey = (f: VendorsFilters = {}) => ['vendors', f] as const

export function useVendors(filters: VendorsFilters = {}) {
  return useQuery({ queryKey: vendorsKey(filters), queryFn: () => fetchVendors(filters) })
}

export function useSetVendorRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorId, categoryId }: { vendorId: string; categoryId: string }) =>
      setVendorCategoryRule(vendorId, categoryId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })  // categories may shift
    },
  })
}

export function useDeleteVendorRule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vendorId: string) => deleteVendorCategoryRule(vendorId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
```

- [ ] **Step 8: Write `frontend/src/hooks/useAISuggestions.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchSuggestions, acceptSuggestion, rejectSuggestion, acceptAllSuggestions,
  generateSuggestion, batchGenerateSuggestions,
  type CategorySuggestion,
} from '@/api/ai'

export const suggestionsKey = (status: 'pending' | 'accepted' | 'rejected' | 'all', limit = 100) =>
  ['ai-suggestions', status, limit] as const

export function useSuggestions(status: 'pending' | 'accepted' | 'rejected' | 'all' = 'pending', limit = 100) {
  return useQuery({ queryKey: suggestionsKey(status, limit), queryFn: () => fetchSuggestions(status, limit) })
}

export function useAcceptSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, createRule = true }: { id: string; createRule?: boolean }) =>
      acceptSuggestion(id, createRule),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] })
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useRejectSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rejectSuggestion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useAcceptAllSuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => acceptAllSuggestions(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-suggestions'] })
      qc.invalidateQueries({ queryKey: ['vendors'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useGenerateSuggestion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorId, force = false }: { vendorId: string; force?: boolean }) =>
      generateSuggestion(vendorId, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}

export function useBatchGenerateSuggestions() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ vendorIds, maxVendors }: { vendorIds?: string[]; maxVendors?: number }) =>
      batchGenerateSuggestions(vendorIds, maxVendors),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-suggestions'] }),
  })
}
```

- [ ] **Step 9: Write `frontend/src/hooks/useCategories.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCategories, createCategory, updateCategory, deleteCategory,
  type Category,
} from '@/api/categories'

export const categoriesKey = () => ['categories'] as const

export function useCategories() {
  return useQuery({ queryKey: categoriesKey(), queryFn: fetchCategories })
}

interface CategoryInput { name: string; icon?: string | null; color?: string | null; sort_order?: number }

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey() }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CategoryInput> }) =>
      updateCategory(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey() }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey() }),
  })
}
```

- [ ] **Step 10: Write `frontend/src/hooks/useWallets.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchWallets, createWallet, updateWallet, deleteWallet, recalculateBalance,
  fetchInstruments, createInstrument, deleteInstrument,
  attachInstruments, detachInstruments, fetchInstitutions,
  type Wallet, type Instrument, type Institution,
} from '@/api/wallets'

export const walletsKey = () => ['wallets'] as const
export const instrumentsKey = () => ['instruments'] as const
export const institutionsKey = () => ['institutions'] as const

export function useWallets() {
  return useQuery({ queryKey: walletsKey(), queryFn: fetchWallets })
}

export function useInstruments() {
  return useQuery({ queryKey: instrumentsKey(), queryFn: fetchInstruments })
}

export function useInstitutions() {
  return useQuery({ queryKey: institutionsKey(), queryFn: fetchInstitutions })
}

interface CreateWalletInput { name: string; currency?: string; instrument_ids?: string[] }
interface CreateInstrumentInput {
  institution_id: string
  type: string
  display_name: string
  last4?: string
  account_tail?: string
}

export function useCreateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateWalletInput) => createWallet(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useUpdateWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CreateWalletInput> }) =>
      updateWallet(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useDeleteWallet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteWallet(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useRecalculateBalance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => recalculateBalance(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: walletsKey() })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

export function useCreateInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInstrumentInput) => createInstrument(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instrumentsKey() })
      qc.invalidateQueries({ queryKey: walletsKey() })
    },
  })
}

export function useDeleteInstrument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteInstrument(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: instrumentsKey() })
      qc.invalidateQueries({ queryKey: walletsKey() })
    },
  })
}

export function useAttachInstruments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, instrumentIds }: { walletId: string; instrumentIds: string[] }) =>
      attachInstruments(walletId, instrumentIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}

export function useDetachInstruments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ walletId, instrumentIds }: { walletId: string; instrumentIds: string[] }) =>
      detachInstruments(walletId, instrumentIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: walletsKey() }),
  })
}
```

- [ ] **Step 11: Write `frontend/src/hooks/useAdapters.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listAdapters, getAdapter, updateAdapterConfig, testPattern,
  type AdapterInfo, type AdapterConfig, type PatternTestResult,
} from '@/api/adapters'

export const adaptersKey = () => ['adapters'] as const
export const adapterKey = (name: string) => ['adapter', name] as const

export function useAdapters() {
  return useQuery({ queryKey: adaptersKey(), queryFn: listAdapters })
}

export function useAdapter(name: string | undefined) {
  return useQuery({
    queryKey: name ? adapterKey(name) : ['adapter', 'undefined'],
    queryFn: () => getAdapter(name!),
    enabled: !!name,
  })
}

export function useUpdateAdapterConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, config }: { name: string; config: Partial<AdapterConfig> }) =>
      updateAdapterConfig(name, config),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adaptersKey() })
      qc.invalidateQueries({ queryKey: adapterKey(vars.name) })
    },
  })
}

export function useTestPattern() {
  return useMutation({
    mutationFn: (input: { sender: string; body: string; source: 'sms' | 'email' }) =>
      testPattern(input),
  })
}
```

- [ ] **Step 12: Write `frontend/src/hooks/useMe.ts`**

```typescript
import { useQuery } from '@tanstack/react-query'
import { fetchCurrentUser, type User } from '@/api/auth'

export const meKey = () => ['me'] as const

export function useMe(enabled = true) {
  return useQuery<User>({ queryKey: meKey(), queryFn: fetchCurrentUser, enabled })
}
```

- [ ] **Step 13: Write 10 screen stubs**

Each stub follows this template (substitute name):

```typescript
// frontend/src/components/screens/<Name>.tsx
import { ScreenComingSoon } from './ScreenComingSoon'
export function <Name>() {
  return <ScreenComingSoon name="<Display>" />
}
```

The 10 files:
- `Login.tsx` → `export function Login()` returning `ScreenComingSoon name="Login"`
- `Dashboard.tsx` → `export function Dashboard()` returning `ScreenComingSoon name="Dashboard"`
- `Transactions.tsx` → `export function Transactions()` returning `ScreenComingSoon name="Transactions"`
- `TransactionDetail.tsx` → `export function TransactionDetail()` returning `ScreenComingSoon name="Transaction Detail"`
- `Budgets.tsx` → `export function Budgets()` returning `ScreenComingSoon name="Budgets & Goals"`
- `Reports.tsx` → `export function Reports()` returning `ScreenComingSoon name="Reports"`
- `Chat.tsx` → `export function Chat()` returning `ScreenComingSoon name="AI Chat"`
- `Vendors.tsx` → `export function Vendors()` returning `ScreenComingSoon name="Vendors"`
- `Categories.tsx` → `export function Categories()` returning `ScreenComingSoon name="Categories"`
- `Settings.tsx` → `export function Settings()` returning `ScreenComingSoon name="Settings"`

- [ ] **Step 14: Rewire `frontend/src/App.tsx`**

Replace 10 `<ScreenComingSoon name="..."/>` route elements with imports + components. Also replace the unauthed Gate's `<ScreenComingSoon name="Login"/>` with the real `<Login/>`.

Imports at top of file:
```typescript
import { Login } from './components/screens/Login'
import { Dashboard } from './components/screens/Dashboard'
import { Transactions } from './components/screens/Transactions'
import { TransactionDetail } from './components/screens/TransactionDetail'
import { Budgets } from './components/screens/Budgets'
import { Reports } from './components/screens/Reports'
import { Chat } from './components/screens/Chat'
import { Vendors } from './components/screens/Vendors'
import { Categories } from './components/screens/Categories'
import { Settings } from './components/screens/Settings'
```

Routes block:
```typescript
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/transactions" element={<Transactions />} />
  <Route path="/transactions/:id" element={<TransactionDetail />} />
  <Route path="/budgets" element={<Budgets />} />
  <Route path="/reports" element={<Reports />} />
  <Route path="/chat" element={<Chat />} />
  <Route path="/vendors" element={<Vendors />} />
  <Route path="/categories" element={<Categories />} />
  <Route path="/settings/*" element={<Settings />} />
  {import.meta.env.DEV && (<Route path="/_kitchen-sink" element={<KitchenSinkLazy />} />)}
  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

Gate:
```typescript
function Gate() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-text-2">Loading…</div>
  if (!user) return <Login />
  return <AuthedShell />
}
```

Keep `ScreenComingSoon` import for any unused stubs (it's still referenced internally — leave it).

- [ ] **Step 15: Verify build + tests still clean**

```bash
cd frontend
npm test -- --run
npx tsc --noEmit
npm run build
npm run lint
```

Expected: 39/39 tests still pass; tsc clean; build clean. Visiting `/`, `/transactions`, etc. in dev still shows the placeholder text — that's intentional.

- [ ] **Step 16: Commit + PR**

```bash
git add frontend/src/hooks/ frontend/src/components/screens/ frontend/src/App.tsx
git commit -m "feat(frontend): Phase 3 hook scaffold + screen stubs"
git push -u origin feat/v2-fe-3-task0-hooks-and-stubs
gh pr create --base develop --title "feat(frontend): Phase 3 hook scaffold + screen stubs" --body "$(cat <<'EOF'
## Summary
- 11 new TanStack Query hook files wrapping existing api/* clients for screens to consume
- 10 screen stub files (delegating to ScreenComingSoon) ready for parallel slot agents to replace
- App.tsx rewired: routes import real screens, login Gate uses Login stub

After this lands, all 10 Phase 3 slot worktree agents branch off the same SHA and only modify their own screen file.

## Test plan
- [x] 39/39 vitest pass
- [x] tsc + build + lint clean

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 17: After PR merges, capture base SHA for slots**

```bash
git checkout develop
git pull --ff-only origin develop
git rev-parse develop > /tmp/v2-phase3-base-sha.txt
cat /tmp/v2-phase3-base-sha.txt
```

This SHA is the base for every parallel slot 3a-3j worktree.

---

## Slot 3a — Login

**Worktree branch:** `feat/v2-fe-3a-login`

**Files:**
- Replace: `frontend/src/components/screens/Login.tsx`

**Handoff reference:** `.handoff/design/app.jsx` → `LoginPage` component (search for it).

**Hooks consumed:**
- `useAuth()` (from `@/contexts/AuthContext`) — exposes `login(username, password)`.

**Spec section:** Phase 3 §3a — "Centered card: emerald mark, serif title, username + password fields, full-width 'Sign in', privacy note ('Your data stays on your hardware')."

**Steps:**

- [ ] **Step 1: Implement Login component**

Create `frontend/src/components/screens/Login.tsx`:

```typescript
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'

export function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-surface border border-line rounded-xl shadow-md p-8">
        <div className="flex flex-col items-center gap-3 mb-6">
          <span className="w-12 h-12 rounded-md bg-accent text-accent-fg flex items-center justify-center font-serif text-2xl font-semibold">
            ₮
          </span>
          <h1 className="font-serif text-2xl font-medium">Transaction <span className="text-text-2 italic">Intelligence</span></h1>
        </div>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <Field label="Username">
            <Input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <div className="text-sm text-debit">{error}</div>}
          <Button type="submit" variant="primary" disabled={submitting || !username || !password} className="w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <div className="text-xs text-text-3 text-center mt-6">
          Your data stays on your hardware.
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test (logic-bearing piece: error display)**

Create `frontend/src/components/screens/Login.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Login } from './Login'
import * as AuthCtx from '@/contexts/AuthContext'

describe('Login', () => {
  it('disables submit when fields empty', () => {
    vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
      user: null, isLoading: false, isAuthenticated: false,
      login: vi.fn(), logout: vi.fn(), refreshUser: vi.fn(),
    } as ReturnType<typeof AuthCtx.useAuth>)
    render(<Login />)
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('shows error when login throws', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'))
    vi.spyOn(AuthCtx, 'useAuth').mockReturnValue({
      user: null, isLoading: false, isAuthenticated: false,
      login, logout: vi.fn(), refreshUser: vi.fn(),
    } as ReturnType<typeof AuthCtx.useAuth>)
    render(<Login />)
    fireEvent.change(screen.getByLabelText(/username/i, { selector: 'input' }), { target: { value: 'u' } })
    fireEvent.change(screen.getByLabelText(/password/i, { selector: 'input' }), { target: { value: 'p' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument())
  })
})
```

(Adjust the mock shape to match the real `useAuth` return — read `frontend/src/contexts/AuthContext.tsx` to confirm.)

- [ ] **Step 3: Run + commit + PR**

```bash
cd frontend && npm test -- --run screens/Login
cd frontend && npx tsc --noEmit && npm run build && npm run lint
cd /home/alex/Documents/coding/transaction_intelligence_app
git add frontend/src/components/screens/Login.tsx frontend/src/components/screens/Login.test.tsx
git commit -m "feat(frontend): Login screen (3a)"
# PR per universal template
```

---

## Slot 3b — Dashboard

**Worktree branch:** `feat/v2-fe-3b-dashboard`

**Files:**
- Replace: `frontend/src/components/screens/Dashboard.tsx` → become `Dashboard/index.tsx`
- Create: `frontend/src/components/screens/Dashboard/index.tsx`
- Create: `frontend/src/components/screens/Dashboard/StatCards.tsx`
- Create: `frontend/src/components/screens/Dashboard/SpendingPace.tsx`
- Create: `frontend/src/components/screens/Dashboard/ByCategoryDonut.tsx`
- Create: `frontend/src/components/screens/Dashboard/BudgetsTopMerchants.tsx`
- Create: `frontend/src/components/screens/Dashboard/InsightsRow.tsx`

**Handoff reference:** `.handoff/design/screens-dashboard.jsx`

**Hooks consumed:**
- `useDashboard({ period_start, period_end, wallet_id? })` from Task 0
- `useSpendingTimeSeries(p)` from Task 0 (called twice — current + previous month)
- `useCategoryBreakdown(p)` from Task 0
- `useTopVendors(p)` from Task 0
- `useBudgets({ month })` from Task 0
- `useInsights(periodStart, periodEnd)` from Phase 2
- `useExportTransactionsCsv()` from Task 0 (for Export button)
- `lastCompleteMonth`, `addMonths`, `monthLabel`, `periodForMonth` from `@/lib/dates`

**Spec section:** Phase 3 §3b — 2×2 grid: top-left Spending pace, top-right By-category donut, bottom-left Budgets + Top merchants, bottom-right AI Insights. 4 stat cards above (Total balance, Spending, Income, Net change).

**Key behaviors:**
- Default month = `lastCompleteMonth()` from `@/lib/dates`.
- Month nav buttons call `addMonths(ym, ±1)` and re-fetch.
- Spending pace chart: takes `daily_data[]` from the two timeseries responses, cumulatively sums `debit_amount`, plots both as lines (current solid, previous dashed). Verdict pill compares cumulative current[today] vs previous[today].
- By-category donut: center stacks "Total" / amount / "AED". Hover slice shows that slice's amount + %.
- Mobile (≤860px): grid collapses to 1-column; sparklines on stat cards drop.

**Tests required (logic-bearing only):**

`screens/Dashboard/SpendingPace.test.tsx`:
- Cumulative computation: given `[10, 5, 20]`, returns `[10, 15, 35]`.
- Verdict pill threshold: if current > prev × 1.02 → "above"; if < prev × 0.98 → "below"; else "on pace".

`screens/Dashboard/ByCategoryDonut.test.tsx`:
- Donut data derived correctly: `categories[] → DonutSlice[]` with color picked from `c1..c8` round-robin.

**Steps:**

- [ ] **Step 1: Delete the single-file stub, create the directory**

```bash
rm frontend/src/components/screens/Dashboard.tsx
mkdir -p frontend/src/components/screens/Dashboard
```

- [ ] **Step 2: Write tests first**

Create test files at the paths above. Match the shapes expected by the api response — read `frontend/src/api/analytics.ts` for the exact `daily_data`, `categories`, etc. shapes.

`SpendingPace.test.tsx` exports a `computeCumulative` helper from `SpendingPace.tsx`. Write it like:

```typescript
import { describe, it, expect } from 'vitest'
import { computeCumulative, verdict } from './SpendingPace'

describe('SpendingPace', () => {
  it('cumulates daily debits', () => {
    expect(computeCumulative([10, 5, 20])).toEqual([10, 15, 35])
  })
  it('handles empty', () => {
    expect(computeCumulative([])).toEqual([])
  })
  it('verdict: above when current > 1.02 * prev', () => {
    expect(verdict(105, 100)).toBe('above')
  })
  it('verdict: below when current < 0.98 * prev', () => {
    expect(verdict(95, 100)).toBe('below')
  })
  it('verdict: on pace within ±2%', () => {
    expect(verdict(101, 100)).toBe('on pace')
    expect(verdict(99, 100)).toBe('on pace')
  })
  it('verdict: returns "no data" when prev is 0', () => {
    expect(verdict(50, 0)).toBe('no data')
  })
})
```

`ByCategoryDonut.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest'
import { categoriesToSlices } from './ByCategoryDonut'

describe('ByCategoryDonut.categoriesToSlices', () => {
  it('maps category responses to donut slices with rotating colors', () => {
    const slices = categoriesToSlices([
      { category_id: '1', category_name: 'Food', total_amount: '50.00' },
      { category_id: '2', category_name: 'Travel', total_amount: '30.00' },
    ])
    expect(slices[0].color).toBe('var(--c1)')
    expect(slices[1].color).toBe('var(--c2)')
    expect(slices[0].amount).toBe(50)
  })

  it('handles empty input', () => {
    expect(categoriesToSlices([])).toEqual([])
  })
})
```

- [ ] **Step 3: Implement subcomponents** — translate handoff/screens-dashboard.jsx into these files. Each consumes its hooks and renders with Phase 2 primitives + charts. Money via `fmt.money`. Tabular nums via `tnum` class.

Required exports from each subcomponent:
- `StatCards.tsx`: `export function StatCards({ data })` (data shape from `useDashboard`)
- `SpendingPace.tsx`: `export function SpendingPace({ ym })` + `export function computeCumulative(daily: number[])` + `export function verdict(current: number, prev: number): 'above' | 'below' | 'on pace' | 'no data'`
- `ByCategoryDonut.tsx`: `export function ByCategoryDonut({ ym })` + `export function categoriesToSlices(cats: CategoryEntry[]): DonutSlice[]`
- `BudgetsTopMerchants.tsx`: `export function BudgetsTopMerchants({ ym })`
- `InsightsRow.tsx`: `export function InsightsRow({ periodStart, periodEnd })`
- `index.tsx`: orchestrator with month nav state + grid layout

- [ ] **Step 4: Run + commit + PR**

```bash
cd frontend && npm test -- --run screens/Dashboard
cd frontend && npx tsc --noEmit && npm run build && npm run lint
git add frontend/src/components/screens/Dashboard
git commit -m "feat(frontend): Dashboard (3b) — stat cards + spending pace + donut + budgets/merchants + insights"
# PR per universal template
```

---

## Slot 3c — Transactions list

**Worktree branch:** `feat/v2-fe-3c-transactions`

**Files:**
- Replace: `frontend/src/components/screens/Transactions.tsx` → become `Transactions/index.tsx`
- Create: `frontend/src/components/screens/Transactions/index.tsx`
- Create: `frontend/src/components/screens/Transactions/FilterPanel.tsx`
- Create: `frontend/src/components/screens/Transactions/ActiveFilterChips.tsx`
- Create: `frontend/src/components/screens/Transactions/SummaryBar.tsx`
- Create: `frontend/src/components/screens/Transactions/TxnList.tsx`

**Handoff reference:** `.handoff/design/screens-transactions.jsx` (skip `TransactionDetail` — that's 3d).

**Hooks consumed:**
- `useTransactions(filters)` — list
- `useTransactionSummary(filters)` — summary bar
- `useBulkUpdateRecurring()` — multi-select action
- `useWallets()` — wallet filter dropdown
- `useCategories()` — category filter dropdown
- `useVendors()` (optional) — vendor filter dropdown
- `useToast()` — feedback

**Spec section:** Phase 3 §3c.

**Key behaviors:**
- Filter panel toggles open/closed (default closed). Has direction, wallet, category, date presets + custom range, amount min/max, recurring/one-off.
- Active filters render as removable chips above the list.
- Summary bar: live, filter-aware (consumes `useTransactionSummary` with the SAME filters).
- List grouped by day (Today / Yesterday / Mon Day). Each row: direction tile, vendor name + badges (Recurring, Pending), meta line (category dot+name · time · wallet · "N sources"), right-aligned amount.
- Multi-select mode: toggled by entering selection state (click a row's leading checkbox area). Bulk action: "Mark as recurring" via `useBulkUpdateRecurring`.
- Pagination: "Showing X–Y of N" + prev/next using `page` + `page_size` in filters.
- Row click → navigate to `/transactions/:id`.

**Tests required:**

`screens/Transactions/FilterPanel.test.tsx` — filter state changes propagate to onChange.
`screens/Transactions/ActiveFilterChips.test.tsx` — removing a chip removes the filter.
`screens/Transactions/SummaryBar.test.tsx` — renders amounts from query.
`screens/Transactions/TxnList.test.tsx` — multi-select state transitions; bulk action calls mutation.

Each test mocks hooks via `vi.spyOn(hookModule, 'useFoo').mockReturnValue(...)`.

**Steps:**

- [ ] **Step 1: Replace stub with directory** (`rm`, `mkdir`).
- [ ] **Step 2: Write tests first.**
- [ ] **Step 3: Implement subcomponents** translating from handoff.
- [ ] **Step 4: Run + commit + PR.**

---

## Slot 3d — Transaction detail

**Worktree branch:** `feat/v2-fe-3d-txn-detail`

**Files:**
- Replace: `frontend/src/components/screens/TransactionDetail.tsx` (single file is fine — small component)

**Handoff reference:** `.handoff/design/screens-transactions.jsx` → `TransactionDetail` component.

**Hooks consumed:**
- `useTransaction(id, includeBody=true)` — load detail + evidence bodies
- `useUpdateTransactionCategory()` — category select
- `useUpdateTransactionNotes()` — notes save/cancel
- `useUpdateRecurring()` (from Phase 2 `useRecurring.ts`) — recurring toggle
- `useCategories()` — category dropdown
- `useToast()`
- `useParams<{ id: string }>()` from react-router

**Spec section:** Phase 3 §3d.

**Key behaviors:**
- Hero: big direction icon, vendor, datetime, large serif amount (credit in green).
- Detail grid: Category (editable Select), Status badge, Wallet · instrument, Reference (mono), Balance after, Source.
- Recurring toggle below detail grid (uses `useUpdateRecurring`).
- Notes: view mode shows existing notes; clicking edit reveals textarea + Save/Cancel. Save calls `useUpdateTransactionNotes`.
- Evidence: one Card per evidence row (SMS/email icon, sender, role badge, monospace raw body if present).
- Back button → `navigate('/transactions')`.

**Tests required:**
- `TransactionDetail.test.tsx`:
  - Recurring toggle calls mutation + (mock checks) invalidates list query — assert mutation was called with correct args
  - Notes save/cancel state machine: clicking Edit shows textarea; Cancel reverts; Save calls mutation

- [ ] **Step 1: Tests + impl + commit + PR.**

---

## Slot 3e — Budgets & Goals

**Worktree branch:** `feat/v2-fe-3e-budgets-goals`

**Files:**
- Replace: stub → `screens/Budgets/index.tsx`
- Create: `screens/Budgets/TotalRing.tsx`, `GoalsRow.tsx`, `CategoryGrid.tsx`, `NewBudgetModal.tsx`, `NewGoalModal.tsx`

**Handoff reference:** `.handoff/design/screens-more.jsx` → `Budgets` component.

**Hooks consumed:**
- `useBudgets({ month })`
- `useBudgetSummary({ month })`
- `useCreateBudget()`, `useDeleteBudget()`
- `useCopyBudgets()` — "Copy last month" button
- `useCategories()` — for create-budget modal
- `useGoals()` (from Phase 2) — savings goals row
- `useCreateGoal()`, `useUpdateGoal()`, `useDeleteGoal()`, `useContributeToGoal()` (from Phase 2)
- `useToast()`
- Date helpers

**Spec section:** Phase 3 §3e.

**Key behaviors:**
- Month nav top-right.
- TotalRing card: ring shows spent vs total limit; remaining figure below.
- GoalsRow: horizontal scroll on mobile, grid on desktop. Each goal shows Ring + name + saved/target + ETA. Add Goal button at the end.
- CategoryGrid: per-category card with icon, name, % used, spent/limit, progress bar (warn >85%, debit if over), remaining / days-left footer, "Over" badge.
- New Budget modal: category Select + monthly limit Input.

**Tests required:**
- `TotalRing.test.tsx` — ring color thresholds (accent ≤85% / warn >85% / debit >100%).
- `GoalsRow.test.tsx` — contribute action clamps at goal target (assert mutation called with correct amount).
- `CategoryGrid.test.tsx` — over-budget badge appears when spent > limit.

---

## Slot 3f — Reports

**Worktree branch:** `feat/v2-fe-3f-reports`

**Files:**
- Replace: stub → single file `screens/Reports.tsx`

**Handoff reference:** `.handoff/design/screens-more.jsx` → `Reports` component.

**Hooks consumed:**
- `useReports()`
- `useReport(id)`
- `useGenerateReport()`, `useDeleteReport()`, `useDownloadReportPdf()`
- `useExportTransactionsCsv()`, `useExportCategoriesCsv()`, `useExportVendorsCsv()`
- `useWallets()` — for wallet picker in generate modal
- Date helpers

**Spec section:** Phase 3 §3f.

**Key behaviors:**
- Quick exports: month picker at top + 3 tiles (Transactions / Categories / Vendors CSV). Click triggers the appropriate export mutation.
- Generated reports list: each row period label, generated date, optional wallet, PDF badge (if has_pdf), download button + delete + expand button. Expand renders `report_markdown` inline. No markdown lib is in `frontend/package.json` today, so render the markdown as a styled `<pre className="whitespace-pre-wrap font-sans text-sm text-text-2 leading-relaxed">{report_markdown}</pre>` block. Adding a markdown renderer (e.g. `react-markdown`) is out of scope for this slot; if you decide it's needed, STOP and report — adding a dep is a shared-file change.
- Generate modal: Monthly vs Custom range (Segmented), include AI insights checkbox.

**Tests required:**
- `Reports.test.tsx` — quick export click calls correct export hook with current month period.
- Generate modal submit calls `useGenerateReport` with the right payload.

---

## Slot 3g — AI Chat

**Worktree branch:** `feat/v2-fe-3g-chat`

**Files:**
- Replace: stub → `screens/Chat/index.tsx`
- Create: `screens/Chat/SessionSidebar.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `Composer.tsx`

**Handoff reference:** `.handoff/design/screens-chat-settings.jsx` → `Chat` component.

**Hooks consumed:**
- `useChatSessions()`, `useChatSession(id)`
- `useCreateChatSession()`, `useDeleteChatSession()`
- `useSendChatMessage()` — replaces handoff's `cannedReply`
- `useOllamaStatus()` — online indicator
- `useWallets()` (optional — for wallet scoping)
- `useToast()`

**Spec section:** Phase 3 §3g.

**Key behaviors:**
- Two-pane on desktop (sidebar 252px + main). Mobile: sidebar becomes overlay below top bar with "← Back to chat" button.
- Sidebar: "New chat" button + session rows (title, relative time, delete).
- Main: header (assistant avatar, "Local · private", online dot), scrollable messages, composer.
- Messages: user (right, accent bg) / assistant (left, surface). Optional highlights (bullets), query_info footer (type + explanation).
- Empty state: suggestion chips ("What did I spend on food this month?", "Top vendors last week", etc.).
- Thinking state: animated "Thinking…" dots after sending, until response arrives.

**Tests required:**
- `Composer.test.tsx` — send composes correct payload (session_id, conversation_history shape). Enter submits unless Shift+Enter (newline).
- `MessageBubble.test.tsx` — renders highlights + query_info when provided.

---

## Slot 3h — Vendors + AI

**Worktree branch:** `feat/v2-fe-3h-vendors`

**Files:**
- Replace: stub → `screens/Vendors/index.tsx`
- Create: `screens/Vendors/VendorRow.tsx`, `SuggestionCard.tsx`, `PendingBanner.tsx`

**Handoff reference:** `.handoff/design/screens-more.jsx` → `Vendors` component.

**Hooks consumed:**
- `useVendors({ search, has_transactions: true })`
- `useSetVendorRule()`, `useDeleteVendorRule()`
- `useSuggestions('pending')` — gated by AI toggle
- `useAcceptSuggestion()`, `useRejectSuggestion()`, `useAcceptAllSuggestions()`, `useGenerateSuggestion()`, `useBatchGenerateSuggestions()`
- `useCategories()`
- `useToast()`

**Spec section:** Phase 3 §3h.

**Key behaviors:**
- Search + AI suggestions toggle at top.
- Pending banner ("N to review") appears when `useSuggestions('pending').data.total > 0`. Accept-all button.
- Vendor row: initials tile, name, Recurring badge (if applicable — depends on Phase 1 recurring on vendor; if not available, omit), txn count + total, category Select rule.
- Below each vendor (if AI on + has pending): SuggestionCard with category + confidence + rationale + Accept/Dismiss/Get suggestion.
- Optimistic UI: Accept moves row to "Accepted" group locally before mutation completes; on error, snap back.

**Tests required:**
- `VendorRow.test.tsx` — category Select change calls `useSetVendorRule`.
- `SuggestionCard.test.tsx` — Accept calls `useAcceptSuggestion` with `createRule: true`; Reject calls `useRejectSuggestion`.

---

## Slot 3i — Categories

**Worktree branch:** `feat/v2-fe-3i-categories`

**Files:**
- Replace: stub → single file `screens/Categories.tsx`

**Handoff reference:** `.handoff/design/screens-more.jsx` → `Categories` component.

**Hooks consumed:**
- `useCategories()`
- `useCreateCategory()`, `useUpdateCategory()`, `useDeleteCategory()`
- `useToast()`

**Spec section:** Phase 3 §3i.

**Key behaviors:**
- Grid of category tiles (icon, name, txn count, delete).
- "New category" Button → Modal with name Input + color swatch picker (use 8 swatches mapped to `c1..c8` CSS vars).
- Delete confirmation via inline button (no scary modal — just a confirm toast or hold-to-delete pattern; simplest is a confirm Modal asking "Delete X?").
- System categories (`is_system: true`) can't be deleted — gray out the delete button.

**Tests required:**
- `Categories.test.tsx` — create modal submit calls `useCreateCategory` with picked color; system category delete button is disabled.

---

## Slot 3j — Settings

**Worktree branch:** `feat/v2-fe-3j-settings`

**Files:**
- Replace: stub → `screens/Settings/index.tsx`
- Create: `screens/Settings/AccountTab.tsx`, `WalletsTab.tsx`, `AdaptersTab.tsx`, `AITab.tsx`

**Handoff reference:** `.handoff/design/screens-chat-settings.jsx` → `Settings` component.

**Hooks consumed:**
- Account: `useMe()`, `useUpdateProfile()`, `useDeleteAccount()` (Phase 2), `changePassword` (call api directly via mutation), 2FA + sessions hooks from 1d-2fa
- Wallets: `useWallets()`, `useInstruments()`, `useInstitutions()`, all wallet/instrument mutations
- Adapters: `useAdapters()`, `useAdapter(name)`, `useUpdateAdapterConfig()`, `useTestPattern()`, `useAdapterStats()`
- AI: `useOllamaStatus()`, `useAISettings()`, `useUpdateAISettings()` (Phase 2)

**Spec section:** Phase 3 §3j.

**Key behaviors:**
- Tabs: Segmented on desktop, 2×2 grid on mobile (Account / Wallets / Bank adapters / AI).
- Nested routes: `/settings/account`, `/settings/wallets`, `/settings/adapters`, `/settings/ai`. App.tsx already routes `/settings/*` → `<Settings/>`; the Settings component handles inner routing.
- Use `useNavigate` + `useLocation` to switch tabs.

### AccountTab specifics

- Profile section: Avatar with name initials (no upload backend — display only).
- Display name Input → `useUpdateProfile({ display_name })` on blur or Save.
- Username read-only.
- Email Input → `useUpdateProfile({ email })`.
- Password change: current/new/confirm Inputs, show-hide toggle, live strength meter (logic-bearing — test it), match validation.
- Security: 2FA Toggle. ON state shows secret/QR setup; verify with TOTP code Input. OFF state hides.
- Active sessions list (`fetchSessions()`); each row has revoke button. "Sign out all" button.
- Preferences: currency Select, date format Select. These persist via `useUpdateProfile({ preferences: { currency, date_format } })`.
- Danger zone (red card): "Delete account" Button → Modal requiring user to type their username before submit; calls `useDeleteAccount()`.

### WalletsTab specifics

- Wallet cards (combined balance, expandable to show instruments, recalc/delete).
- Instruments list at bottom (add card/account Modal, delete).
- Link/unlink instruments to wallets via attach/detach mutations.

### AdaptersTab specifics

- Adapter rows: name, sources, status badge, parser_count, enable Toggle.
- Click row → expand to show parsers, config (parse mode Segmented), test pattern panel.
- Use `useAdapterStats(name)` for the parsed-count display (currently always 0 per spec).

### AITab specifics

- Connection status card: green/red dot + base URL + model.
- "Test connection" Button → re-runs `useOllamaStatus()` query.
- Base URL + Model Inputs → `useUpdateAISettings({ ollama_base_url, ollama_model })` on Save.
- Feature toggles: chat / categorize / parse. Persists via `useUpdateAISettings({ features: {...} })`.

**Tests required (logic-bearing):**

- `AccountTab.test.tsx` — password strength meter for "abc" / "AbCd1234!" / "p@ssw0rd" → weak / strong / medium tiers.
- `AccountTab.test.tsx` — delete account modal requires typing exact username to enable submit.
- `WalletsTab.test.tsx` (optional) — attach instrument mutation called with correct args.
- `AdaptersTab.test.tsx` — test pattern button calls `useTestPattern` with form inputs.

**Steps:**

- [ ] **Step 1: Replace stub with directory + create 4 tab files + index.tsx orchestrator.**
- [ ] **Step 2: Write tests.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run + commit + PR.**

---

## Phase 3 Acceptance Gate (after all 10 slots merge)

- [ ] **Step 1: Sync develop locally**

```bash
git checkout develop
git pull --ff-only origin develop
```

- [ ] **Step 2: Full test suite**

```bash
cd frontend && npm test -- --run
```

Expected: ≥80 tests green (Phase 2's 39 + ~5 per slot × 10 = ~45 new ≈ 85 total). Adjust expectation based on what slots actually shipped.

- [ ] **Step 3: Build + lint**

```bash
cd frontend && npm run build && npm run lint
```

Expected: clean. Bundle size <500 KB gzipped overall.

- [ ] **Step 4: Manual walkthrough**

Open `make up` dev URL. For each route:
- Light + dark mode
- 360px / 1024px / 1280px viewport
- Default emerald + one other accent (set via DevTools `tt-accent` in localStorage)
- Every CTA, modal, mutation
- Confirm Network tab: real endpoints fire, no MOCK data

- [ ] **Step 5: Backend smoke**

Visit a transaction detail with a multi-source merge to verify evidence loads. Open AI chat, send a question, verify response renders with highlights + query_info. Open Settings → Account, change display name, refresh, verify it persists.

- [ ] **Step 6: Rebase develop on main (prep for Phase 4)**

```bash
git rebase main
git push --force-with-lease origin develop
```

Phase 3 complete. Phase 4 (cutover + cleanup) can now be planned.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-10-v2-phase3-screens.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Task 0 runs sequentially in this session; once it merges, I dispatch 10 worktree-isolated agents (one per slot) in parallel with `isolation: "worktree"`. Per-slot spec + quality reviews before merging. Best fit for parallel-screen execution.

**2. Inline Execution** — Sequential, no parallelism. Wouldn't take advantage of the slot design.

Which approach?
