import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { createMemberMock, deleteMemberMock, listMembersMock, updateMemberMock } = vi.hoisted(() => ({
  createMemberMock: vi.fn(), deleteMemberMock: vi.fn(), listMembersMock: vi.fn(), updateMemberMock: vi.fn(),
}))

vi.mock('./api', () => ({
  createMember: createMemberMock, deleteMember: deleteMemberMock, listMembers: listMembersMock, updateMember: updateMemberMock,
}))

import { SettingsPage } from './SettingsPage'

beforeEach(() => {
  vi.restoreAllMocks()
  createMemberMock.mockReset(); deleteMemberMock.mockReset(); updateMemberMock.mockReset()
  listMembersMock.mockResolvedValue([
    { id: 'creator-1', username: 'creator', isCreator: true },
    { id: 'member-2', username: 'lin', isCreator: false },
  ])
})
afterEach(cleanup)

it('does not offer edit or delete actions for the creator', async () => {
  render(<SettingsPage />)

  expect(await screen.findByText('创建者')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '编辑 creator' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: '删除 creator' })).not.toBeInTheDocument()
})

it('updates a member token without displaying the existing token', async () => {
  updateMemberMock.mockResolvedValue({ id: 'member-2', username: 'lin', isCreator: false })
  render(<SettingsPage />)
  fireEvent.click(await screen.findByRole('button', { name: '编辑 lin' }))
  fireEvent.change(screen.getByLabelText('lin 的新 Token'), { target: { value: 'new-secure-member-token' } })
  fireEvent.click(screen.getByRole('button', { name: '保存 lin' }))

  await waitFor(() => expect(updateMemberMock).toHaveBeenCalledWith({ id: 'member-2', username: 'lin', token: 'new-secure-member-token' }))
  expect(screen.queryByDisplayValue('new-secure-member-token')).not.toBeInTheDocument()
})

it('does not delete a member when deletion is cancelled', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<SettingsPage />)
  fireEvent.click(await screen.findByRole('button', { name: '删除 lin' }))

  expect(deleteMemberMock).not.toHaveBeenCalled()
})
