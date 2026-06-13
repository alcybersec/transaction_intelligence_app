import { computeSlices, type DonutSlice } from './Donut.helpers'

function arcPath(
  cx: number,
  cy: number,
  r: number,
  start: number,
  end: number,
  innerR: number,
): string {
  const large = end - start > Math.PI ? 1 : 0
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  const xi1 = cx + innerR * Math.cos(end)
  const yi1 = cy + innerR * Math.sin(end)
  const xi2 = cx + innerR * Math.cos(start)
  const yi2 = cy + innerR * Math.sin(start)
  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
    `L ${xi1} ${yi1}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2}`,
    'Z',
  ].join(' ')
}

interface DonutProps {
  data: DonutSlice[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerAmount?: string
  centerSuffix?: string
}

export function Donut({
  data,
  size = 220,
  thickness = 32,
  centerLabel,
  centerAmount,
  centerSuffix,
}: DonutProps) {
  const slices = computeSlices(data)
  const r = size / 2 - 4
  const innerR = r - thickness
  const cx = size / 2
  const cy = size / 2

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.length === 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={r - thickness / 2}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={thickness}
          />
        )}
        {slices.map((s, i) => (
          <path key={i} d={arcPath(cx, cy, r, s.start, s.end, innerR)} fill={s.color} />
        ))}
      </svg>
      {(centerLabel || centerAmount || centerSuffix) && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ width: size, height: size }}
        >
          {centerLabel && <div className="text-xs text-text-2">{centerLabel}</div>}
          {centerAmount && (
            <div className="font-serif text-[26px] font-semibold tnum">{centerAmount}</div>
          )}
          {centerSuffix && <div className="text-xs text-text-3 mt-0.5">{centerSuffix}</div>}
        </div>
      )}
    </div>
  )
}
