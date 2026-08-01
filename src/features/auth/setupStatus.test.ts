import { expect, it, vi } from 'vitest'
import { getInitialSetupStatus } from './setupStatus'

it('returns whether the server needs its first household', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: { setupRequired: true }, error: null })

  await expect(getInitialSetupStatus({ functions: { invoke } } as never)).resolves.toBe(true)
  expect(invoke).toHaveBeenCalledWith('initial-setup-status')
})

it('rejects malformed status data instead of guessing', async () => {
  const invoke = vi.fn().mockResolvedValue({ data: {}, error: null })

  await expect(getInitialSetupStatus({ functions: { invoke } } as never))
    .rejects.toThrow('初始化状态响应无效。')
})
