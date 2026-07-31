import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LowStockPanel } from '../reminders/LowStockPanel'
import { filterInventory, type InventoryFilters } from './filters'

type InventoryRow = {
  id: string
  quantity: number
  unit: string
  low_stock_threshold: number
  products: { name: string; specification: string | null; category: string | null }[]
  storage_locations: { id: string; name: string; room_id: string; rooms: { name: string }[] }[]
}

type Room = { id: string; name: string }
type Location = { id: string; room_id: string; name: string }

const emptyFilters: InventoryFilters = { roomId: '', locationId: '', category: '', lowStockOnly: false }

export function InventoryListPage() {
  const [items, setItems] = useState<InventoryRow[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [filters, setFilters] = useState(emptyFilters)
  const [message, setMessage] = useState('正在读取库存…')

  const load = useCallback(() => {
    let active = true
    void (async () => {
      try {
        const { supabase } = await import('../../lib/supabase')
        const [{ data: itemRows, error: itemsError }, { data: roomRows, error: roomsError }, { data: locationRows, error: locationsError }] = await Promise.all([
          supabase
            .from('inventory_items')
            .select('id, quantity, unit, low_stock_threshold, products(name, specification, category), storage_locations(id, name, room_id, rooms(name))')
            .order('updated_at', { ascending: false }),
          supabase.from('rooms').select('id, name').order('name'),
          supabase.from('storage_locations').select('id, room_id, name').order('name'),
        ])
        if (itemsError) throw itemsError
        if (roomsError) throw roomsError
        if (locationsError) throw locationsError
        if (active) {
          const typedItems = (itemRows ?? []) as unknown as InventoryRow[]
          setItems(typedItems)
          setRooms((roomRows ?? []) as Room[])
          setLocations((locationRows ?? []) as Location[])
          setMessage(typedItems.length === 0 ? '还没有物品，扫码或手动录入第一件吧。' : '')
        }
      } catch {
        if (active) setMessage('暂时无法读取库存，请稍后重试。')
      }
    })()
    return () => { active = false }
  }, [])

  useEffect(() => load(), [load])
  useEffect(() => { const refresh = () => { void load() }; window.addEventListener('inventory-updated', refresh); return () => window.removeEventListener('inventory-updated', refresh) }, [load])

  const matchingLocations = useMemo(
    () => locations.filter((location) => !filters.roomId || location.room_id === filters.roomId),
    [filters.roomId, locations],
  )
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.products[0]?.category).filter((category): category is string => Boolean(category)))).sort(),
    [items],
  )
  const filteredItems = useMemo(() => filterInventory(items, filters), [items, filters])

  function selectRoom(roomId: string) {
    setFilters((current) => {
      const selectedLocation = locations.find((location) => location.id === current.locationId)
      return {
        ...current,
        roomId,
        locationId: roomId && selectedLocation && selectedLocation.room_id !== roomId ? '' : current.locationId,
      }
    })
  }

  return <main>
    <header><p>家藏</p><h1>家庭库存</h1><Link to="/inventory/new">扫码入库</Link></header>
    <LowStockPanel />
    <form className="inventory-filters" aria-label="库存筛选" onSubmit={(event) => event.preventDefault()}>
      <label>房间<select value={filters.roomId} onChange={(event) => selectRoom(event.target.value)}><option value="">全部房间</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
      <label>存放点<select value={filters.locationId} onChange={(event) => setFilters((current) => ({ ...current, locationId: event.target.value }))}><option value="">全部存放点</option>{matchingLocations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
      <label>分类<select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}><option value="">全部分类</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
      <label className="low-stock-filter"><input type="checkbox" checked={filters.lowStockOnly} onChange={(event) => setFilters((current) => ({ ...current, lowStockOnly: event.target.checked }))} />仅看低库存</label>
    </form>
    {message ? <p>{message}</p> : filteredItems.length === 0 ? <p>没有符合筛选条件的物品。</p> : <ul>{filteredItems.map((item) => { const product = item.products[0]; const location = item.storage_locations[0]; return <li key={item.id}><Link to={`/inventory/${item.id}`}><strong>{product?.name ?? '未命名商品'}</strong><span>{product?.specification ?? ''}</span><b data-low={item.quantity <= item.low_stock_threshold}>{item.quantity} {item.unit}</b><small>{location?.rooms[0]?.name ?? '未设置房间'} / {location?.name ?? '未设置存放点'}</small></Link></li> })}</ul>}
  </main>
}
