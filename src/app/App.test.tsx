import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../features/auth/api', () => ({
  restoreSession: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
}))

import { App } from './App'

afterEach(() => {
  cleanup()
})

describe('App routes', () => {
  it('renders the login page at /login', async () => {
    window.history.pushState({}, '', '/login')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '登录家庭库存' })).toBeInTheDocument()
  })

  it('redirects unknown unauthenticated routes to login', async () => {
    window.history.pushState({}, '', '/unavailable')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '登录家庭库存' })).toBeInTheDocument()
  })
})
