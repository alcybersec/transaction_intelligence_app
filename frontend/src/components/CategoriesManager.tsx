/**
 * Categories management component.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Save, X, Tag, Lock } from 'lucide-react'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  Category,
} from '../api/categories'

export function CategoriesManager() {
  const queryClient = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', icon: '', color: '' })
  const [isCreating, setIsCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', icon: '', color: '#4CAF50' })

  const { data: categories, isLoading, error } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  })

  const createMutation = useMutation({
    mutationFn: (data: { name: string; icon?: string; color?: string }) =>
      createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsCreating(false)
      setCreateForm({ name: '', icon: '', color: '#4CAF50' })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; icon?: string; color?: string } }) =>
      updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setEditingId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  const startEditing = (cat: Category) => {
    setEditingId(cat.id)
    setEditForm({ name: cat.name, icon: cat.icon || '', color: cat.color || '' })
  }

  const handleUpdate = () => {
    if (!editingId) return
    updateMutation.mutate({
      id: editingId,
      data: {
        name: editForm.name || undefined,
        icon: editForm.icon || undefined,
        color: editForm.color || undefined,
      },
    })
  }

  const handleCreate = () => {
    if (!createForm.name.trim()) return
    createMutation.mutate({
      name: createForm.name.trim(),
      icon: createForm.icon || undefined,
      color: createForm.color || undefined,
    })
  }

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Delete category "${name}"? Transactions will become uncategorized.`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading categories...</div>
  }

  if (error) {
    return <div className="text-center py-8 text-destructive">Failed to load categories</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Categories
        </h3>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </button>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="rounded-lg border border-primary bg-primary/5 p-4">
          <h4 className="font-medium mb-3">New Category</h4>
          <div className="grid grid-cols-3 gap-3">
            <input
              type="text"
              value={createForm.name}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Category name"
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <input
              type="text"
              value={createForm.icon}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, icon: e.target.value }))}
              placeholder="Icon name (optional)"
              className="px-3 py-2 rounded-md border border-input bg-background text-sm"
            />
            <div className="flex gap-2">
              <input
                type="color"
                value={createForm.color}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, color: e.target.value }))}
                className="w-10 h-10 rounded-md border border-input cursor-pointer"
              />
              <button
                onClick={handleCreate}
                disabled={!createForm.name.trim() || createMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                Save
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setCreateForm({ name: '', icon: '', color: '#4CAF50' })
                }}
                className="px-3 py-2 rounded-md border border-input hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {createMutation.error && (
            <p className="text-sm text-destructive mt-2">
              {createMutation.error instanceof Error ? createMutation.error.message : 'Failed to create'}
            </p>
          )}
        </div>
      )}

      {/* Categories List */}
      <div className="rounded-lg border border-border overflow-hidden">
        {categories?.map((cat, index) => (
          <div
            key={cat.id}
            className={`flex items-center gap-4 p-4 ${index > 0 ? 'border-t border-border' : ''}`}
          >
            {editingId === cat.id ? (
              // Edit Mode
              <>
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: editForm.color || cat.color || '#9E9E9E' }}
                />
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
                />
                <input
                  type="text"
                  value={editForm.icon}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, icon: e.target.value }))}
                  placeholder="icon"
                  className="w-24 px-3 py-1.5 rounded-md border border-input bg-background text-sm"
                />
                <input
                  type="color"
                  value={editForm.color || '#9E9E9E'}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-8 h-8 rounded border border-input cursor-pointer"
                />
                <button
                  onClick={handleUpdate}
                  disabled={updateMutation.isPending}
                  className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-2 rounded-md border border-input hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              // View Mode
              <>
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color || '#9E9E9E' }}
                />
                <div className="flex-1">
                  <span className="font-medium">{cat.name}</span>
                  {cat.icon && (
                    <span className="text-sm text-muted-foreground ml-2">({cat.icon})</span>
                  )}
                </div>
                {cat.is_system ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    System
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => startEditing(cat)}
                      className="p-2 rounded-md hover:bg-muted"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat.id, cat.name)}
                      disabled={deleteMutation.isPending}
                      className="p-2 rounded-md hover:bg-destructive/10 text-destructive"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
