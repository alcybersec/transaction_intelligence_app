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
