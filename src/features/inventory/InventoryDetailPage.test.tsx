import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it } from 'vitest'
import { InventoryDetailPage } from './InventoryDetailPage'

it('does not render a return-to-inventory link while loading', () => {
  render(<MemoryRouter initialEntries={['/inventory/item-1']}><Routes><Route path="/inventory/:id" element={<InventoryDetailPage />} /></Routes></MemoryRouter>)

  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
