export interface MiniBar {
  label: string
  value: number
  color?: string
}

interface MiniBarsProps {
  bars: MiniBar[]
  height?: number
  className?: string
}

export function MiniBars({ bars, height = 80, className }: MiniBarsProps) {
  if (bars.length === 0) {
    return <div className={className} style={{ height }} />
  }
  const max = Math.max(...bars.map((b) => b.value), 0) || 1
  return (
    <div className={className}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {bars.map((b, i) => {
          const h = Math.max(2, (b.value / max) * height)
          return (
            <div
              key={i}
              className="flex-1 rounded-sm"
              style={{
                height: h,
                background: b.color ?? 'var(--accent)',
              }}
              title={`${b.label}: ${b.value}`}
            />
          )
        })}
      </div>
      <div className="flex gap-1.5 mt-1">
        {bars.map((b, i) => (
          <div key={i} className="flex-1 text-[11px] text-text-2 text-center truncate">
            {b.label}
          </div>
        ))}
      </div>
    </div>
  )
}
