interface AreaTrendProps {
  current: number[]
  previous?: number[]
  width?: number
  height?: number
  className?: string
}

function buildPath(values: number[], width: number, height: number, min: number, range: number) {
  if (values.length === 0) return ''
  const step = width / Math.max(values.length - 1, 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)} ${y.toFixed(1)}`
  })
  return `M ${points.join(' L ')}`
}

export function AreaTrend({
  current,
  previous,
  width = 300,
  height = 120,
  className,
}: AreaTrendProps) {
  const all = [...current, ...(previous ?? [])]
  const hasData = all.length > 0
  const max = hasData ? Math.max(...all, 0) : 1
  const min = hasData ? Math.min(...all, 0) : 0
  const range = max - min || 1

  const currentPath = buildPath(current, width, height, min, range)
  const previousPath = previous ? buildPath(previous, width, height, min, range) : ''

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      {previousPath && (
        <path
          d={previousPath}
          fill="none"
          stroke="var(--text-3)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {currentPath && (
        <path
          d={currentPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      <line x1={0} y1={height} x2={width} y2={height} stroke="var(--line)" strokeWidth={1} />
    </svg>
  )
}
