import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Field } from '@/components/primitives/Field'
import { cn } from '@/lib/cn'

// 8 swatches mapped to c1..c8 CSS vars (per design spec).
const SWATCHES: { value: string; label: string }[] = [
  { value: 'var(--c1)', label: 'Green' },
  { value: 'var(--c2)', label: 'Blue' },
  { value: 'var(--c3)', label: 'Violet' },
  { value: 'var(--c4)', label: 'Amber' },
  { value: 'var(--c5)', label: 'Red' },
  { value: 'var(--c6)', label: 'Teal' },
  { value: 'var(--c7)', label: 'Pink' },
  { value: 'var(--c8)', label: 'Slate' },
]

interface NewGoalModalProps {
  open: boolean
  onClose: () => void
  isSubmitting: boolean
  onSubmit: (input: {
    name: string
    target_amount: string
    target_date: string
    color: string
  }) => void
}

function todayPlusMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

export function NewGoalModal({ open, onClose, isSubmitting, onSubmit }: NewGoalModalProps) {
  const [name, setName] = useState('')
  const [target, setTarget] = useState('')
  const [date, setDate] = useState('')
  const [color, setColor] = useState(SWATCHES[0].value)

  useEffect(() => {
    if (open) {
      setName('')
      setTarget('')
      setDate(todayPlusMonths(6))
      setColor(SWATCHES[0].value)
    }
  }, [open])

  const numericTarget = Number(target)
  const canSubmit =
    !!name.trim() &&
    target !== '' &&
    numericTarget > 0 &&
    !!date &&
    !isSubmitting

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({
      name: name.trim(),
      target_amount: target,
      target_date: date,
      color,
    })
  }

  return (
    <Modal open={open} onClose={onClose} title="New savings goal">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Name">
          <Input
            type="text"
            placeholder="Emergency fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Target amount">
          <Input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="5000"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label="Target date">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Color">
          <div className="flex gap-2 flex-wrap">
            {SWATCHES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-label={s.label}
                aria-pressed={color === s.value}
                onClick={() => setColor(s.value)}
                className={cn(
                  'w-8 h-8 rounded-full border-2 transition-transform',
                  color === s.value
                    ? 'border-text scale-110'
                    : 'border-transparent hover:scale-105',
                )}
                style={{ background: s.value }}
              />
            ))}
          </div>
        </Field>
        <div className="flex gap-2 justify-end mt-1">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!canSubmit}>
            {isSubmitting ? 'Saving…' : 'Create goal'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
