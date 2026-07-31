import { expect, it, vi } from 'vitest'
import { loadOpenReminders } from './api'

it('requests non-ignored items and filters by threshold in the client', async () => {
  const eq = vi.fn().mockResolvedValue({ data: [{ quantity: 1, low_stock_threshold: 1 }, { quantity: 3, low_stock_threshold: 1 }], error: null })
  const from = vi.fn(() => ({ select: () => ({ eq }) }))
  await expect(loadOpenReminders({ from } as never)).resolves.toHaveLength(1)
  expect(from).toHaveBeenCalledWith('inventory_items')
  expect(eq).toHaveBeenCalledWith('reminder_ignored', false)
})
