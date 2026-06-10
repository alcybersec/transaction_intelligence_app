import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Field } from '@/components/primitives/Field'
import type { Category } from '@/api/categories'

interface NewBudgetModalProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  existingCategoryIds: string[]
  isSubmitting: boolean
  onSubmit: (input: { category_id: string; limit_amount: string }) => void
  currency?: string
}

export function NewBudgetModal({
  open,
  onClose,
  categories,
  existingCategoryIds,
  isSubmitting,
  onSubmit,
  currency = 'AED',
}: NewBudgetModalProps) {
  // Filter out the "Income" / "Transfer" system categories — budgets only apply
  // to expense categories. Heuristic: anything whose name matches those labels.
  const available = categories.filter((c) => {
    if (existingCategoryIds.includes(c.id)) return false
    const lower = c.name.toLowerCase()
    if (lower === 'income' || lower === 'transfer' || lower === 'transfers') return false
    return true
  })

  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')

  useEffect(() => {
    if (open) {
      setCategoryId(available[0]?.id ?? '')
      setLimit('')
    }
    // We intentionally do not include `available` in deps — it changes shape
    // every render, which would reset the form mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const numericLimit = Number(limit)
  const canSubmit = !!categoryId && limit !== '' && numericLimit > 0 && !isSubmitting

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    onSubmit({ category_id: categoryId, limit_amount: limit })
  }

  return (
    <Modal open={open} onClose={onClose} title="New budget">
      {available.length === 0 ? (
        <div className="text-sm text-text-2">
          All eligible categories already have a budget this month.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Category">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`Monthly limit (${currency})`}>
            <Input
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="1000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
            />
          </Field>
          <div className="flex gap-2 justify-end mt-1">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={!canSubmit}>
              {isSubmitting ? 'Saving…' : 'Create budget'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
