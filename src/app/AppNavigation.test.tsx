import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import { AppNavigation } from './AppNavigation'

it('keeps scan entry in the primary navigation with the other mobile destinations', () => {
  render(<MemoryRouter><AppNavigation /></MemoryRouter>)
  const navigation = screen.getByRole('navigation', { name: '家庭库存导航' })
  const destinations = navigation.querySelector('.app-nav-links')

  expect(destinations).not.toBeNull()

  for (const name of ['库存', '位置', '成员', '扫码入库']) {
    expect(within(destinations as HTMLElement).getByRole('link', { name })).toBeInTheDocument()
  }
})
