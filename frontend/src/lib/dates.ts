export type YMKey = string // "YYYY-MM"

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function parseYm(ym: YMKey): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

export function addMonths(ym: YMKey, n: number): YMKey {
  const { year, month } = parseYm(ym)
  const total = year * 12 + (month - 1) + n
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
