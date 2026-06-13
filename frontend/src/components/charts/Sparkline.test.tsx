import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Sparkline } from './Sparkline'

describe('Sparkline', () => {
  it('renders without crashing on empty data', () => {
    const { container } = render(<Sparkline values={[]} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders a path with one point', () => {
    const { container } = render(<Sparkline values={[10]} />)
    expect(container.querySelector('path')).toBeTruthy()
  })

  it('handles all-equal values without NaN', () => {
    const { container } = render(<Sparkline values={[5, 5, 5, 5]} />)
    const path = container.querySelector('path')
    expect(path?.getAttribute('d')).not.toContain('NaN')
  })
})
