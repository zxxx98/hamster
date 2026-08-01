import { expect, it, vi } from 'vitest'
import { bootstrapInitialHousehold } from './initialSetup'

const input = {
  householdName: '我的家庭',
  username: 'creator_1',
  token: 'a-secure-creator-token',
  setupSecret: 'one-time-setup-secret',
}

it('sends the setup secret only as the bootstrap request header', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { id: 'creator-id', username: 'creator_1' }, error: null })

  await expect(bootstrapInitialHousehold({ functions: { invoke } } as never, input))
    .resolves.toEqual({ id: 'creator-id', username: 'creator_1' })

  expect(invoke).toHaveBeenCalledWith('bootstrap-household', {
    body: { householdName: '我的家庭', username: 'creator_1', token: 'a-secure-creator-token' },
    headers: { 'x-initial-setup-secret': 'one-time-setup-secret' },
  })
})

it('rejects an empty setup secret before making a network request', async () => {
  const invoke = vi.fn()

  await expect(bootstrapInitialHousehold(
    { functions: { invoke } } as never,
    { ...input, setupSecret: '  ' },
  )).rejects.toThrow('请输入初始化密钥。')

  expect(invoke).not.toHaveBeenCalled()
})
