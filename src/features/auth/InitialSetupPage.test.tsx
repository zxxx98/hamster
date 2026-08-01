import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { bootstrapMock, signInMock } = vi.hoisted(() => ({
  bootstrapMock: vi.fn(),
  signInMock: vi.fn(),
}))

vi.mock('./initialSetup', () => ({ bootstrapInitialHousehold: bootstrapMock }))
vi.mock('./api', () => ({ signIn: signInMock }))

import { InitialSetupPage } from './InitialSetupPage'

afterEach(cleanup)

beforeEach(() => {
  bootstrapMock.mockReset()
  signInMock.mockReset()
})

function renderPage() {
  const onSession = vi.fn()
  render(<MemoryRouter><InitialSetupPage onSession={onSession} /></MemoryRouter>)
  return onSession
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('家庭名称'), { target: { value: '我的家庭' } })
  fireEvent.change(screen.getByLabelText('创建者账号'), { target: { value: 'creator_1' } })
  fireEvent.change(screen.getByLabelText('创建者 Token'), { target: { value: 'a-secure-creator-token' } })
  fireEvent.change(screen.getByLabelText('初始化密钥'), { target: { value: 'one-time-setup-secret' } })
}

it.each([
  [401, '初始化密钥不正确。'],
  [409, '该服务器已经完成初始化，请直接登录。'],
  [503, '初始化暂不可用，请联系服务器管理员。'],
])('shows a safe message for bootstrap HTTP %s', async (status, message) => {
  bootstrapMock.mockRejectedValueOnce({ context: { status } })
  renderPage()
  fillForm()

  fireEvent.click(screen.getByRole('button', { name: '创建家庭' }))

  expect(await screen.findByRole('alert')).toHaveTextContent(message)
  expect(signInMock).not.toHaveBeenCalled()
})

it('signs in only after bootstrap succeeds', async () => {
  bootstrapMock.mockResolvedValueOnce({ id: 'creator-id', username: 'creator_1' })
  signInMock.mockResolvedValueOnce({})
  const onSession = renderPage()
  fillForm()

  fireEvent.click(screen.getByRole('button', { name: '创建家庭' }))

  await waitFor(() => {
    expect(signInMock).toHaveBeenCalledWith('creator_1', 'a-secure-creator-token')
  })
  expect(onSession).toHaveBeenCalledOnce()
})
