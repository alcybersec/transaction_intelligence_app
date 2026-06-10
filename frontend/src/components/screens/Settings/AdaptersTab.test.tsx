import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { AdaptersTab } from './AdaptersTab'
import { ToastProvider } from '@/components/primitives/ToastContext'

const testPatternMock = vi.fn().mockResolvedValue({
  adapter_detected: 'mashreq',
  institution_name: 'Mashreq',
  parsers_matched: ['debit'],
  parse_result: { amount: '12.50' },
  parse_error: null,
})

vi.mock('@/api/adapters', () => ({
  listAdapters: vi.fn().mockResolvedValue([
    {
      institution_name: 'mashreq',
      display_name: 'Mashreq',
      country: 'AE',
      version: '1.0',
      supported_sources: ['sms', 'email'],
      sms_sender_patterns: ['MASHREQ'],
      email_sender_patterns: [],
      parser_count: 3,
      is_active: true,
      description: 'Mashreq bank parser',
    },
  ]),
  getAdapter: vi.fn().mockResolvedValue({
    institution_name: 'mashreq',
    display_name: 'Mashreq',
    country: 'AE',
    version: '1.0',
    supported_sources: ['sms', 'email'],
    sms_sender_patterns: ['MASHREQ'],
    email_sender_patterns: [],
    parser_count: 3,
    is_active: true,
    description: 'Mashreq bank parser',
    parsers: [],
    ai_parse_prompt_available: false,
    ai_categorize_prompt_available: false,
  }),
  updateAdapterConfig: vi.fn(),
  testPattern: (input: unknown) => testPatternMock(input),
  fetchAdapterStats: vi.fn().mockResolvedValue({ parsed_count: 0, last_parsed_at: null }),
}))

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AdaptersTab />
      </ToastProvider>
    </QueryClientProvider>,
  )
}

describe('AdaptersTab — test pattern', () => {
  it('calls testPattern with form inputs', async () => {
    renderTab()

    // Wait for adapter row to render.
    await waitFor(() => {
      expect(screen.getByText('Mashreq')).toBeInTheDocument()
    })

    // Expand the adapter row to reveal the test pattern panel.
    fireEvent.click(screen.getByTestId('adapter-row-mashreq'))

    // Fill in sender + body and click Test.
    const sender = await screen.findByTestId('test-pattern-sender')
    const body = screen.getByTestId('test-pattern-body')
    fireEvent.change(sender, { target: { value: 'MASHREQ' } })
    fireEvent.change(body, { target: { value: 'Debit AED 50' } })

    const btn = screen.getByTestId('test-pattern-button')
    fireEvent.click(btn)

    await waitFor(() => {
      expect(testPatternMock).toHaveBeenCalledTimes(1)
    })
    expect(testPatternMock).toHaveBeenCalledWith({
      sender: 'MASHREQ',
      body: 'Debit AED 50',
      source: 'sms',
    })
  })
})
