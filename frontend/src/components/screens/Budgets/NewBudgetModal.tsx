import { useEffect, useState, type FormEvent } from 'react'
import { Modal } from '@/components/primitives/Modal'
import { Button } from '@/components/primitives/Button'
import { Input } from '@/components/primitives/Input'
import { Select } from '@/components/primitives/Select'
import { Field } from '@/components/primitives/Field'
import { Segmented } from '@/components/primitives/Segmented'
import type { Category } from '@/api/categories'

type BudgetType = 'category' | 'overall'

interface NewBudgetModalProps {
  open: boolean
  onClose: () => void
  categories: Category[]
  existingCategoryIds: string[]
  hasOverallBudget: boolean
  isSubmitting: boolean
  onSubmit: (input: { category_id?: string; limit_amount: string }) => void
  currency?: string
}

export function NewBudgetModal({
  open,
  onClose,
  categories,
  existingCategoryIds,
  hasOverallBudget,
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

  const [type, setType] = useState<BudgetType>('category')
  const [categoryId, setCategoryId] = useState('')
  const [limit, setLimit] = useState('')

  useEffect(() => {
    if (open) {
      // Default to whichever type is still available — if an overall budget
      // already exists for the month, start on the category tab.
      const initial: BudgetType = hasOverallBudget
        ? 'category'
        : available.length === 0
          ? 'overall'
          : 'category'
      setType(initial)
      setCategoryId(available[0]?.id ?? '')
      setLimit('')
    }
    // We intentionally do not include `available` / `hasOverallBudget` in deps
    // — `available` changes shape every render, which would reset the form
    // mid-edit. `hasOverallBudget` only matters at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const numericLimit = Number(limit)
  const canSubmit =
    limit !== '' &&
    numericLimit > 0 &&
    !isSubmitting &&
    (type === 'overall' ? !hasOverallBudget : !!categoryId)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    if (type === 'overall') {
      onSubmit({ limit_amount: limit })
    } else {
      onSubmit({ category_id: categoryId, limit_amount: limit })
    }
  }

  const noCategoriesLeft = available.length === 0
  const everythingTaken = noCategoriesLeft && hasOverallBudget

  return (
    <Modal open={open} onClose={onClose} title="New budget">
      {everythingTaken ? (
        <div className="text-sm text-text-2">
          All eligible categories already have a budget this month, and an
          overall budget already exists.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Type">
            <Segmented<BudgetType>
              options={[
                { value: 'category', label: 'Category' },
                { value: 'overall', label: 'Overall (all spending)' },
              ]}
              value={type}
              onChange={setType}
            />
          </Field>

          {type === 'category' ? (
            noCategoriesLeft ? (
              <div className="text-sm text-text-2">
                All eligible categories already have a budget this month.
              </div>
            ) : (
              <Field label="Category">
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )
          ) : hasOverallBudget ? (
            <div className="text-sm text-text-2">
              An overall budget already exists for this month.
            </div>
          ) : (
            <div className="text-xs text-text-3">
              Caps total monthly spending across every category.
            </div>
          )}

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
