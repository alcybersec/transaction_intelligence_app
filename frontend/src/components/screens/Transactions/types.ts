/**
 * Shared filter-state types for the Transactions list.
 *
 * The UI state holds strings (form-friendly). When we issue API requests we
 * convert these to `TransactionFilters` (numbers + booleans). Splitting the
 * shape keeps form inputs simple and avoids cache churn from incidental `''`
 * vs `undefined` differences.
 */

export type DatePreset =
  | 'all'
  | 'this-month'
  | 'last-month'
  | 'last-30'
  | 'custom'

export interface UiFilters {
  search: string
  direction: '' | 'debit' | 'credit'
  wallet_id: string
  category_id: string
  date_from: string
  date_to: string
  amount_min: string
  amount_max: string
  recurring: '' | 'yes' | 'no'
}

export const EMPTY_FILTERS: UiFilters = {
  search: '',
  direction: '',
  wallet_id: '',
  category_id: '',
  date_from: '',
  date_to: '',
  amount_min: '',
  amount_max: '',
  recurring: '',
}
