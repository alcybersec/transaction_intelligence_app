import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  padded?: boolean
}

export function Card({ children, padded = true, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'bg-surface border border-line rounded-lg shadow-sm',
        padded && 'p-4',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}
