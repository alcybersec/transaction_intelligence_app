import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full bg-surface border border-line rounded-md px-3 py-1.5 text-sm',
          'placeholder:text-text-3',
          'focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-ring',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          className,
        )}
        {...rest}
      />
    )
  },
)
