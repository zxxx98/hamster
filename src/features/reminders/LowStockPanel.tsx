import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadOpenReminders } from './api'

type Reminder = { id: string; quantity: number; unit: string; products: { name: string }[] }
export function LowStockPanel() {
  const [items, setItems] = useState<Reminder[]>([])
  async function load() { const { supabase } = await import('../../lib/supabase'); const rows = await loadOpenReminders(supabase as never); setItems(rows as unknown as Reminder[]) }
  useEffect(() => { void load().catch(() => undefined) }, [])
  if (items.length === 0) return null
  return <section aria-label="低库存提醒"><h2>需要补充</h2><ul>{items.map((item) => <li key={item.id}><Link to={`/inventory/${item.id}`}>{item.products[0]?.name ?? '未命名商品'}：{item.quantity} {item.unit}</Link><button type="button" onClick={async () => { const { supabase } = await import('../../lib/supabase'); await supabase.from('inventory_items').update({ reminder_ignored: true }).eq('id', item.id); await load() }}>忽略提醒</button></li>)}</ul></section>
}
