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
  wallet_ids_include: string[]
  wallet_ids_exclude: string[]
  category_ids_include: string[]
  category_ids_exclude: string[]
  date_from: string
  date_to: string
  amount_min: string
  amount_max: string
  recurring: '' | 'yes' | 'no'
}

export const EMPTY_FILTERS: UiFilters = {
  search: '',
  direction: '',
  wallet_ids_include: [],
  wallet_ids_exclude: [],
  category_ids_include: [],
  category_ids_exclude: [],
  date_from: '',
  date_to: '',
  amount_min: '',
  amount_max: '',
  recurring: '',
}
