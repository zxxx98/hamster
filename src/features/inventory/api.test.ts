import { expect, it, vi } from 'vitest'
import { changeStock } from './api'

it('sends a consume action to the atomic database RPC', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { id: 'item-1', quantity: 2 }, error: null })
  await changeStock({ rpc } as never, 'item-1', { type: 'consume', amount: 1 })
  expect(rpc).toHaveBeenCalledWith('apply_inventory_action', {
    item_id: 'item-1', action: 'consume', amount: 1, note: null,
  })
})
