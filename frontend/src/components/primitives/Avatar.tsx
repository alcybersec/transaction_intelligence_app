import { cn } from '@/lib/cn'

interface AvatarProps {
  name?: string
  src?: string
  size?: number
  className?: string
}

function initials(name?: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  const style = { width: size, height: size, fontSize: size * 0.4 }
  if (src) {
    return (
      <img
        src={src}
        alt={name || ''}
        style={style}
        className={cn('rounded-full object-cover', className)}
      />
    )
  }
  return (
    <div
      style={style}
      className={cn(
        'rounded-full bg-accent-soft text-accent flex items-center justify-center font-medium select-none',
        className,
      )}
      aria-label={name}
    >
      {initials(name)}
    </div>
  )
}
