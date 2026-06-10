export interface HeatmapCell {
  date: string
  value: number
}

interface HeatmapProps {
  cells: HeatmapCell[]
  cellSize?: number
  gap?: number
  weeks?: number
}

// Compose background color by mixing surface-3 (zero) and accent (max) by intensity.
function cellBackground(value: number, max: number): string {
  if (max <= 0 || value <= 0) return 'var(--surface-3)'
  const f = Math.min(1, value / max)
  // CSS color-mix lets us interpolate against OKLCH tokens at render time.
  const accentPct = Math.round(f * 100)
  return `color-mix(in oklch, var(--accent) ${accentPct}%, var(--surface-3))`
}

export function Heatmap({ cells, cellSize = 12, gap = 2, weeks }: HeatmapProps) {
  if (cells.length === 0) {
    return <div className="inline-block" />
  }

  // Bucket into [dayOfWeek (Mon=0..Sun=6), weekIndex]
  const first = new Date(cells[0].date)
  const startDow = (first.getDay() + 6) % 7 // Mon=0
  const positioned = cells.map((c, i) => {
    const offset = i + startDow
    const dow = offset % 7
    const week = Math.floor(offset / 7)
    return { ...c, dow, week }
  })
  const maxWeek = positioned.reduce((m, c) => Math.max(m, c.week), 0)
  const totalWeeks = weeks ?? maxWeek + 1
  const max = positioned.reduce((m, c) => Math.max(m, c.value), 0)

  const width = totalWeeks * (cellSize + gap) - gap
  const height = 7 * (cellSize + gap) - gap

  return (
    <div
      className="inline-grid"
      style={{
        gridTemplateColumns: `repeat(${totalWeeks}, ${cellSize}px)`,
        gridTemplateRows: `repeat(7, ${cellSize}px)`,
        gridAutoFlow: 'column',
        gap: `${gap}px`,
        width,
        height,
      }}
    >
      {Array.from({ length: totalWeeks * 7 }).map((_, idx) => {
        const week = Math.floor(idx / 7)
        const dow = idx % 7
        const cell = positioned.find((c) => c.week === week && c.dow === dow)
        const bg = cell ? cellBackground(cell.value, max) : 'transparent'
        return (
          <div
            key={idx}
            className="rounded-sm"
            style={{
              width: cellSize,
              height: cellSize,
              background: bg,
              gridColumn: week + 1,
              gridRow: dow + 1,
            }}
            title={cell ? `${cell.date}: ${cell.value}` : undefined}
          />
        )
      })}
    </div>
  )
}
