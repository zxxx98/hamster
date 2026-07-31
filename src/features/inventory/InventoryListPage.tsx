import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type InventoryRow = {
  id: string
  quantity: number
  unit: string
  low_stock_threshold: number
  products: { name: string; specification: string | null }[]
  storage_locations: { name: string; rooms: { name: string }[] }[]
}

export function InventoryListPage() {
  const [items, setItems] = useState<InventoryRow[]>([])
  const [message, setMessage] = useState('正在读取库存…')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const { supabase } = await import('../../lib/supabase')
        const { data, error } = await supabase
          .from('inventory_items')
          .select('id, quantity, unit, low_stock_threshold, products(name, specification), storage_locations(name, rooms(name))')
          .order('updated_at', { ascending: false })
        if (error) throw error
        if (active) {
          setItems(data ?? [])
          setMessage((data ?? []).length === 0 ? '还没有物品，扫码或手动录入第一件吧。' : '')
        }
      } catch {
        if (active) setMessage('暂时无法读取库存，请稍后重试。')
      }
    })()
    return () => { active = false }
  }, [])

  return <main><header><p>家藏</p><h1>家庭库存</h1><Link to="/inventory/new">扫码入库</Link></header>{message ? <p>{message}</p> : <ul>{items.map((item) => { const product = item.products[0]; const location = item.storage_locations[0]; return <li key={item.id}><Link to={`/inventory/${item.id}`}><strong>{product?.name ?? '未命名商品'}</strong><span>{product?.specification ?? ''}</span><b data-low={item.quantity <= item.low_stock_threshold}>{item.quantity} {item.unit}</b><small>{location?.rooms[0]?.name ?? '未设置房间'} / {location?.name ?? '未设置存放点'}</small></Link></li> })}</ul>}</main>
}
