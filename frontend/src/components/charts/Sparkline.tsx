interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}

export function Sparkline({
  values,
  width = 80,
  height = 24,
  stroke = 'var(--accent)',
}: SparklineProps) {
  if (values.length === 0) {
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} />
  }
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / Math.max(values.length - 1, 1)
  const points = values.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const d = `M ${points.join(' L ')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
