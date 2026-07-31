import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { changeStock } from './api'

export function InventoryEntryPage() {
  const navigate = useNavigate()
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const roomName = String(form.get('room') ?? '').trim()
    const locationName = String(form.get('location') ?? '').trim()
    const quantity = Number(form.get('quantity'))
    const unit = String(form.get('unit') ?? '件').trim()
    const threshold = Number(form.get('threshold'))
    if (!name || !roomName || !locationName || !Number.isInteger(quantity) || quantity <= 0 || !Number.isInteger(threshold) || threshold < 0) {
      setMessage('请填写商品、房间、存放点，以及有效的数量和低库存阈值。')
      return
    }
    setIsSaving(true); setMessage(null)
    try {
      const { supabase } = await import('../../lib/supabase')
      const { data: sessionData } = await supabase.auth.getUser()
      const userId = sessionData.user?.id
      if (!userId) throw new Error('请重新登录')
      const { data: profile, error: profileError } = await supabase.from('profiles').select('household_id').eq('id', userId).single()
      if (profileError || !profile) throw new Error('未找到家庭信息')
      const householdId = profile.household_id
      const { data: product, error: productError } = await supabase.from('products').insert({ household_id: householdId, name, barcode: String(form.get('barcode') ?? '').trim() || null, brand: String(form.get('brand') ?? '').trim() || null, specification: String(form.get('specification') ?? '').trim() || null }).select('id').single()
      if (productError || !product) throw productError ?? new Error('无法创建商品')
      const { data: room, error: roomError } = await supabase.from('rooms').upsert({ household_id: householdId, name: roomName }, { onConflict: 'household_id,name' }).select('id').single()
      if (roomError || !room) throw roomError ?? new Error('无法保存房间')
      const { data: location, error: locationError } = await supabase.from('storage_locations').upsert({ household_id: householdId, room_id: room.id, name: locationName }, { onConflict: 'household_id,room_id,name' }).select('id').single()
      if (locationError || !location) throw locationError ?? new Error('无法保存存放点')
      const { data: item, error: itemError } = await supabase.from('inventory_items').insert({ household_id: householdId, product_id: product.id, location_id: location.id, unit, low_stock_threshold: threshold }).select('id').single()
      if (itemError || !item) throw itemError ?? new Error('无法创建库存项')
      await changeStock(supabase, item.id, { type: 'restock', amount: quantity })
      navigate(`/inventory/${item.id}`, { replace: true })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally { setIsSaving(false) }
  }

  return <main><header><a href="/">返回库存</a><h1>录入物品</h1><p>扫码结果可修改；初始数量会记录为一次补货。</p></header><form onSubmit={save}><label>商品名称<input name="name" required /></label><label>条形码<input name="barcode" inputMode="numeric" /></label><label>品牌<input name="brand" /></label><label>规格<input name="specification" /></label><label>房间<input name="room" placeholder="厨房" required /></label><label>存放点<input name="location" placeholder="橱柜" required /></label><label>数量<input name="quantity" type="number" min="1" step="1" required /></label><label>单位<input name="unit" defaultValue="包" required /></label><label>低库存阈值<input name="threshold" type="number" min="0" step="1" defaultValue="1" required /></label>{message ? <p role="alert">{message}</p> : null}<button type="submit" disabled={isSaving}>{isSaving ? '正在保存…' : '保存入库'}</button></form></main>
}
