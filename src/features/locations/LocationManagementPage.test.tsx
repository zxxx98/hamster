import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}))

import { LocationManagementPage } from './LocationManagementPage'

it('does not render a return-to-inventory link', () => {
  render(<MemoryRouter><LocationManagementPage /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '位置' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
