import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { restoreSessionMock, signInMock } = vi.hoisted(() => ({
  restoreSessionMock: vi.fn(),
  signInMock: vi.fn(),
}))

vi.mock('../features/auth/api', () => ({
  restoreSession: restoreSessionMock,
  signIn: signInMock,
}))

import { App } from './App'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  restoreSessionMock.mockReset()
  restoreSessionMock.mockResolvedValue(null)
  signInMock.mockReset()
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

  it('shows the private inventory page after a successful login', async () => {
    signInMock.mockResolvedValue({})
    window.history.pushState({}, '', '/login')

    render(<App />)

    fireEvent.change(await screen.findByLabelText('账号'), { target: { value: 'member_a' } })
    fireEvent.change(screen.getByLabelText('Token'), { target: { value: 'a-secure-member-token' } })
    fireEvent.click(screen.getByRole('button', { name: '登录' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '家庭库存' })).toBeInTheDocument()
    })
    expect(signInMock).toHaveBeenCalledWith('member_a', 'a-secure-member-token')
  })
})
