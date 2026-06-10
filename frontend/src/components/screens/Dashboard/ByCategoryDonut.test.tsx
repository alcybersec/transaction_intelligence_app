import { describe, it, expect } from 'vitest'
import { categoriesToSlices } from './ByCategoryDonut'

describe('ByCategoryDonut.categoriesToSlices', () => {
  it('maps category responses to donut slices with rotating colors', () => {
    const slices = categoriesToSlices([
      {
        category_id: '1',
        category_name: 'Food',
        category_icon: null,
        category_color: null,
        total_amount: '50.00',
        transaction_count: 1,
        percentage: 50,
      },
      {
        category_id: '2',
        category_name: 'Travel',
        category_icon: null,
        category_color: null,
        total_amount: '30.00',
        transaction_count: 1,
        percentage: 30,
      },
    ])
    expect(slices[0].color).toBe('var(--c1)')
    expect(slices[1].color).toBe('var(--c2)')
    expect(slices[0].amount).toBe(50)
    expect(slices[0].label).toBe('Food')
  })

  it('rotates through c1..c8 then wraps to c1 on 9th entry', () => {
    const cats = Array.from({ length: 9 }, (_, i) => ({
      category_id: String(i),
      category_name: `Cat ${i}`,
      category_icon: null,
      category_color: null,
      total_amount: '10.00',
      transaction_count: 1,
      percentage: 0,
    }))
    const slices = categoriesToSlices(cats)
    expect(slices[0].color).toBe('var(--c1)')
    expect(slices[7].color).toBe('var(--c8)')
    expect(slices[8].color).toBe('var(--c1)')
  })

  it('prefers explicit category_color when provided', () => {
    const slices = categoriesToSlices([
      {
        category_id: '1',
        category_name: 'Food',
        category_icon: null,
        category_color: '#abcdef',
        total_amount: '50.00',
        transaction_count: 1,
        percentage: 50,
      },
    ])
    expect(slices[0].color).toBe('#abcdef')
  })

  it('handles empty input', () => {
    expect(categoriesToSlices([])).toEqual([])
  })
})
