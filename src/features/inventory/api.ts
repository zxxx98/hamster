import type { StockAction } from '../../domain/inventory'

type RpcClient = {
  rpc: (name: string, args: { item_id: string; action: StockAction['type']; amount: number | null; note: string | null }) => Promise<{ data: unknown; error: unknown }>
}

export async function changeStock(client: RpcClient, itemId: string, action: StockAction, note: string | null = null) {
  const amount = action.type === 'deplete' ? null : action.amount
  const { data, error } = await client.rpc('apply_inventory_action', {
    item_id: itemId, action: action.type, amount, note,
  })
  if (error) throw error
  return data
}
