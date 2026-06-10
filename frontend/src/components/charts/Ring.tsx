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
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={thickness}
        />
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
