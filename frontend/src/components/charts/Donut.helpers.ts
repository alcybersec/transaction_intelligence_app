export interface DonutSlice {
  label: string
  amount: number
  color: string
}

export interface ComputedSlice extends DonutSlice {
  pct: number
  start: number // radians
  end: number // radians
}

export function computeSlices(data: DonutSlice[]): ComputedSlice[] {
  const total = data.reduce((s, x) => s + x.amount, 0)
  if (total <= 0) return []
  let cursor = -Math.PI / 2 // start at 12 o'clock
  return data.map((slice) => {
    const angle = (slice.amount / total) * Math.PI * 2
    const start = cursor
    const end = cursor + angle
    cursor = end
    return { ...slice, pct: (slice.amount / total) * 100, start, end }
  })
}
