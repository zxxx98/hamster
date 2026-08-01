import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { restoreSessionMock, signInMock, getInitialSetupStatusMock } = vi.hoisted(() => ({
  restoreSessionMock: vi.fn(),
  signInMock: vi.fn(),
  getInitialSetupStatusMock: vi.fn(),
}))

vi.mock('../features/auth/api', () => ({
  restoreSession: restoreSessionMock,
  signIn: signInMock,
}))

vi.mock('../features/auth/setupStatus', () => ({
  getInitialSetupStatus: getInitialSetupStatusMock,
}))

import { App } from './App'

afterEach(() => {
  cleanup()
})

beforeEach(() => {
  restoreSessionMock.mockReset()
  restoreSessionMock.mockResolvedValue(null)
  signInMock.mockReset()
  getInitialSetupStatusMock.mockReset()
  getInitialSetupStatusMock.mockResolvedValue(false)
})

describe('App routes', () => {
  it('renders the login page at /login', async () => {
    window.history.pushState({}, '', '/login')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '登录家庭库存' })).toBeInTheDocument()
  })

  it('renders the public initial setup page at /setup', async () => {
    getInitialSetupStatusMock.mockResolvedValue(true)
    window.history.pushState({}, '', '/setup')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '创建家庭库存' })).toBeInTheDocument()
  })

  it('redirects a new deployment to setup', async () => {
    getInitialSetupStatusMock.mockResolvedValue(true)
    window.history.pushState({}, '', '/login')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '创建家庭库存' })).toBeInTheDocument()
  })

  it('redirects initialized deployments away from setup', async () => {
    window.history.pushState({}, '', '/setup')

    render(<App />)

    expect(await screen.findByRole('heading', { name: '登录家庭库存' })).toBeInTheDocument()
  })

  it('shows a retryable message when initial state cannot be loaded', async () => {
    getInitialSetupStatusMock.mockRejectedValue(new Error('offline'))
    window.history.pushState({}, '', '/login')

    render(<App />)

    expect(await screen.findByRole('alert')).toHaveTextContent('暂时无法确认初始化状态。')
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument()
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
