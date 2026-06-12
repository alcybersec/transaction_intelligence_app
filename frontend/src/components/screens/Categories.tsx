import { useEffect, useState } from 'react'
import { Button } from '../primitives/Button'
import { Card } from '../primitives/Card'
import { Field } from '../primitives/Field'
import { Input } from '../primitives/Input'
import { Modal } from '../primitives/Modal'
import { Icon } from '../icons/Icon'
import { useToast } from '../primitives/ToastContext'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
} from '@/hooks/useCategories'
import type { Category } from '@/api/categories'

const PALETTE: string[] = [
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--c4)',
  'var(--c5)',
  'var(--c6)',
  'var(--c7)',
  'var(--c8)',
]

export function Categories() {
  const { data: categories, isLoading } = useCategories()
  const createMut = useCreateCategory()
  const deleteMut = useDeleteCategory()
  const toast = useToast()

  const [showNew, setShowNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null)

  const handleCreate = (name: string, color: string) => {
    createMut.mutate(
      { name, color, icon: 'tag' },
      {
        onSuccess: () => {
          toast.show('Category created', 'credit')
          setShowNew(false)
        },
        onError: (err) => {
          toast.show((err as Error)?.message || 'Failed to create category', 'debit')
        },
      },
    )
  }

  const handleDelete = (cat: Category) => {
    deleteMut.mutate(cat.id, {
      onSuccess: () => {
        toast.show('Category deleted', 'neutral')
        setConfirmDelete(null)
      },
      onError: (err) => {
        toast.show((err as Error)?.message || 'Failed to delete category', 'debit')
      },
    })
  }

  return (
    <div className="max-w-maxw mx-auto px-5 py-6">
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="font-serif text-2xl mb-1">Categories</h1>
          <p className="text-sm text-text-2">
            Organize spending into groups for budgets and reports.
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowNew(true)}>
          <Icon name="plus" size={16} />
          New category
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <div className="text-sm text-text-2">Loading…</div>
        </Card>
      ) : !categories || categories.length === 0 ? (
        <Card>
          <div className="text-sm text-text-2">
            No categories yet. Click &quot;New category&quot; to create your first.
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((c) => (
            <CategoryTile
              key={c.id}
              category={c}
              onDelete={() => setConfirmDelete(c)}
            />
          ))}
        </div>
      )}

      <NewCategoryModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onSubmit={handleCreate}
        submitting={createMut.isPending}
      />

      <DeleteConfirmModal
        category={confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        deleting={deleteMut.isPending}
      />
    </div>
  )
}

interface TileProps {
  category: Category
  onDelete: () => void
}

function CategoryTile({ category, onDelete }: TileProps) {
  const color = category.color || 'var(--c8)'
  const bg = `color-mix(in oklch, ${color} 16%, var(--surface))`
  const isSystem = category.is_system

  return (
    <Card className="flex items-center gap-3">
      <span
        className="inline-flex items-center justify-center rounded-md shrink-0"
        style={{ width: 36, height: 36, background: bg, color }}
        aria-hidden="true"
      >
        <Icon name={category.icon || 'tag'} size={18} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{category.name}</div>
        <div className="text-xs text-text-2">
          {category.transaction_count.toLocaleString()} transaction
          {category.transaction_count === 1 ? '' : 's'}
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDelete}
        disabled={isSystem}
        aria-label={`Delete ${category.name}`}
        title={isSystem ? 'System category' : undefined}
      >
        <Icon name="trash" size={16} />
      </Button>
    </Card>
  )
}

interface NewModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, color: string) => void
  submitting?: boolean
}

function NewCategoryModal({ open, onClose, onSubmit, submitting }: NewModalProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(PALETTE[0])

  useEffect(() => {
    if (open) {
      setName('')
      setColor(PALETTE[0])
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title="New category">
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input
            placeholder="e.g. Pets"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Color">
          <div className="flex gap-2 flex-wrap">
            {PALETTE.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setColor(p)}
                aria-label={`Color ${p}`}
                aria-pressed={color === p}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: p,
                  border:
                    color === p ? '2px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </Field>
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim() || submitting}
            onClick={() => onSubmit(name.trim(), color)}
          >
            Create
          </Button>
        </div>
      </div>
    </Modal>
  )
}

interface DeleteModalProps {
  category: Category | null
  onClose: () => void
  onConfirm: (cat: Category) => void
  deleting?: boolean
}

function DeleteConfirmModal({ category, onClose, onConfirm, deleting }: DeleteModalProps) {
  return (
    <Modal open={!!category} onClose={onClose} title="Delete category">
      {category && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-2">
            Delete &ldquo;{category.name}&rdquo;? Transactions in this category will be
            uncategorized.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={deleting}
              onClick={() => onConfirm(category)}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
