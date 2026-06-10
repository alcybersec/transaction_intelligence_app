import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/api/categories'

export const categoriesKey = () => ['categories'] as const

export function useCategories() {
  return useQuery({ queryKey: categoriesKey(), queryFn: fetchCategories })
}

interface CategoryInput {
  name: string
  icon?: string
  color?: string
  sort_order?: number
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CategoryInput) => createCategory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey() }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CategoryInput> }) =>
      updateCategory(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey() }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: categoriesKey() }),
  })
}
