import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { createMember, deleteMember, listMembers, restoreSession, updateMember } from './api'

describe('restoreSession', () => {
  it('returns null when Supabase has no saved session', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    }

    await expect(restoreSession(client)).resolves.toBeNull()
  })
})

describe('member management', () => {
  const invoke = vi.fn()
  const client = { functions: { invoke } }

  beforeEach(() => invoke.mockReset())

  it('sends update details to the member management function', async () => {
    invoke.mockResolvedValue({ data: { id: 'member-2', username: 'lin', isCreator: false }, error: null })

    await updateMember({ id: 'member-2', username: 'lin', token: 'a-replacement-token' }, client)

    expect(invoke).toHaveBeenCalledWith('manage-members', {
      body: { action: 'update', id: 'member-2', username: 'lin', token: 'a-replacement-token' },
    })
  })

  it('uses distinct actions for listing, creating, and deleting members', async () => {
    invoke.mockResolvedValue({ data: [], error: null })

    await listMembers(client)
    await createMember('lin', 'a-secure-member-token', client)
    await deleteMember('member-2', client)

    expect(invoke).toHaveBeenNthCalledWith(1, 'manage-members', { body: { action: 'list' } })
    expect(invoke).toHaveBeenNthCalledWith(2, 'manage-members', { body: { action: 'create', username: 'lin', token: 'a-secure-member-token' } })
    expect(invoke).toHaveBeenNthCalledWith(3, 'manage-members', { body: { action: 'delete', id: 'member-2' } })
  })

  it('rejects invalid replacement tokens before invoking the function', async () => {
    await expect(updateMember({ id: 'member-2', username: 'lin', token: 'short' }, client)).rejects.toThrow('Token 至少需要 16 个字符。')
    expect(invoke).not.toHaveBeenCalled()
  })
})
