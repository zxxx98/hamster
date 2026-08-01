import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { MemberManagementPage } from './MemberManagementPage'

it('does not render a return-to-inventory link', () => {
  render(<MemoryRouter><MemberManagementPage /></MemoryRouter>)

  expect(screen.getByRole('heading', { name: '家庭成员' })).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: '返回库存' })).not.toBeInTheDocument()
})
