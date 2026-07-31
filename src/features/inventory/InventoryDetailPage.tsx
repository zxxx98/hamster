import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { changeStock } from './api'
import { StockActionForm } from './StockActionForm'

type Detail = { id: string; quantity: number; unit: string; low_stock_threshold: number; products: { name: string; specification: string | null; image_url: string | null }[]; storage_locations: { name: string; photo_path: string | null; rooms: { name: string }[] }[] }
type Event = { id: string; kind: string; quantity_before: number; quantity_after: number; created_at: string }

export function InventoryDetailPage() {
  const { id } = useParams(); const [item, setItem] = useState<Detail | null>(null); const [events, setEvents] = useState<Event[]>([]); const [imageUrl, setImageUrl] = useState<string | null>(null); const [message, setMessage] = useState('正在读取物品…')
  async function load() { try { const { supabase } = await import('../../lib/supabase'); const { data, error } = await supabase.from('inventory_items').select('id, quantity, unit, low_stock_threshold, products(name, specification, image_url), storage_locations(name, photo_path, rooms(name))').eq('id', id ?? '').single(); if (error || !data) throw error; const typedItem = data as Detail; const imagePath = typedItem.products[0]?.image_url; if (imagePath) { const { data: signed } = await supabase.storage.from('location-photos').createSignedUrl(imagePath, 3600); setImageUrl(signed?.signedUrl ?? null) } else setImageUrl(null); const { data: eventData, error: eventError } = await supabase.from('inventory_events').select('id, kind, quantity_before, quantity_after, created_at').eq('item_id', id ?? '').order('created_at', { ascending: false }); if (eventError) throw eventError; setItem(typedItem); setEvents((eventData ?? []) as Event[]); setMessage('') } catch { setMessage('暂时无法读取该物品。') } }
  useEffect(() => { void load() }, [id])
  if (!item) return <main><Link to="/">返回库存</Link><p>{message}</p></main>
  const product = item.products[0]; const location = item.storage_locations[0]; const low = item.quantity <= item.low_stock_threshold
  return <main><Link to="/">返回库存</Link><h1>{product?.name ?? '未命名商品'}</h1><p>{product?.specification ?? ''}</p>{imageUrl ? <img src={imageUrl} alt={`${product?.name ?? '商品'}图片`} /> : null}<p data-low={low}>{item.quantity} {item.unit}{low ? ' · 库存不足' : ''}</p><p>{location?.rooms[0]?.name ?? '未设置房间'} / {location?.name ?? '未设置存放点'}</p><StockActionForm quantity={item.quantity} onAction={async (action) => { const { supabase } = await import('../../lib/supabase'); await changeStock(supabase, item.id, action); await load() }} /><h2>操作记录</h2><ul>{events.map((event) => <li key={event.id}>{event.kind === 'restock' ? '补货' : event.kind === 'consume' ? '取用' : '用完'}：{event.quantity_before} → {event.quantity_after} · {new Date(event.created_at).toLocaleString()}</li>)}</ul></main>
}
