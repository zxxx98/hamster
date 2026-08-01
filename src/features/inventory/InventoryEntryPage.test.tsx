import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it, vi } from 'vitest'

vi.mock('../catalog/BarcodeScanner', () => ({
  BarcodeScanner: () => <div data-testid="barcode-scanner" />,
}))

import { InventoryEntryPage } from './InventoryEntryPage'

it('relies on persistent navigation instead of a return-to-inventory link', () => {
  render(<MemoryRouter><InventoryEntryPage /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '录入物品' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
