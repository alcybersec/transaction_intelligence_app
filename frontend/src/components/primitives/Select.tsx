import { forwardRef } from 'react'
import type { SelectHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options?: { value: string; label: string }[]
  children?: ReactNode
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, options, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'w-full bg-surface border border-line rounded-md px-3 py-1.5 text-sm',
        'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring',
        'disabled:opacity-50',
        className,
      )}
      {...rest}
    >
      {options
        ? options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        : children}
    </select>
  )
})
