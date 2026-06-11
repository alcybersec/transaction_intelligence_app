import type { DonutSlice } from '@/components/charts/Donut.helpers'
import type { CategorySpending } from '@/api/analytics'

const PALETTE = [
  'var(--c1)',
  'var(--c2)',
  'var(--c3)',
  'var(--c4)',
  'var(--c5)',
  'var(--c6)',
  'var(--c7)',
  'var(--c8)',
]

/**
 * Map category breakdown entries to donut slices. Honors `category_color`
 * when supplied; otherwise rotates through the c1..c8 palette.
 */
export function categoriesToSlices(cats: CategorySpending[]): DonutSlice[] {
  return cats.map((c, i) => ({
    label: c.category_name,
    amount: Number(c.total_amount) || 0,
    color: c.category_color || PALETTE[i % PALETTE.length],
  }))
}
