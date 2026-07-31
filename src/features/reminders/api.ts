export async function loadOpenReminders(client: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: boolean) => Promise<{ data: Array<{ quantity: number; low_stock_threshold: number }> | null; error: unknown }> } } }) {
  const { data, error } = await client.from('inventory_items').select('*, products(*), storage_locations(*, rooms(*))').eq('reminder_ignored', false)
  if (error) throw error
  return (data ?? []).filter((item) => item.quantity <= item.low_stock_threshold)
}
