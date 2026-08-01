import { FormEvent, useCallback, useEffect, useState } from 'react'
import { uploadLocationPhoto } from './api'

type Room = { id: string; name: string }
type Location = {
  id: string
  name: string
  room_id: string
  photo_path: string | null
  rooms: { name: string }[]
}

export function LocationManagementPage() {
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [rooms, setRooms] = useState<Room[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({})
  const [message, setMessage] = useState('正在读取位置…')
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingRoom, setIsSavingRoom] = useState(false)
  const [isSavingLocation, setIsSavingLocation] = useState(false)
  const [uploadingLocationId, setUploadingLocationId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const { supabase } = await import('../../lib/supabase')
      const { data: userData, error: userError } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (userError || !userId) throw userError ?? new Error('请重新登录')

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('household_id')
        .eq('id', userId)
        .single()
      if (profileError || !profile) throw profileError ?? new Error('未找到家庭信息')

      const [{ data: roomRows, error: roomsError }, { data: locationRows, error: locationsError }] = await Promise.all([
        supabase.from('rooms').select('id, name').order('name'),
        supabase.from('storage_locations').select('id, name, room_id, photo_path, rooms(name)').order('name'),
      ])
      if (roomsError) throw roomsError
      if (locationsError) throw locationsError

      const typedLocations = (locationRows ?? []) as unknown as Location[]
      const signedEntries = await Promise.all(typedLocations.map(async (location) => {
        if (!location.photo_path) return [location.id, null] as const
        const { data, error } = await supabase.storage.from('location-photos').createSignedUrl(location.photo_path, 3600)
        if (error) throw error
        return [location.id, data.signedUrl] as const
      }))

      setHouseholdId(profile.household_id)
      setRooms((roomRows ?? []) as Room[])
      setLocations(typedLocations)
      setPhotoUrls(Object.fromEntries(signedEntries))
      setMessage('')
    } catch {
      setMessage('暂时无法读取位置，请稍后重试。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { void load(); const refresh = () => { void load() }; window.addEventListener('household-data-updated', refresh); return () => window.removeEventListener('household-data-updated', refresh) }, [load])

  async function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = String(new FormData(event.currentTarget).get('room') ?? '').trim()
    if (!name || !householdId) return
    setIsSavingRoom(true)
    setMessage('')
    try {
      const { supabase } = await import('../../lib/supabase')
      const { error } = await supabase
        .from('rooms')
        .upsert({ household_id: householdId, name }, { onConflict: 'household_id,name' })
      if (error) throw error
      event.currentTarget.reset()
      await load()
    } catch {
      setMessage('无法保存房间，请重试。')
    } finally {
      setIsSavingRoom(false)
    }
  }

  async function createLocation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const roomId = String(form.get('roomId') ?? '')
    const name = String(form.get('location') ?? '').trim()
    if (!roomId || !name || !householdId) {
      setMessage('请选择房间并填写存放点名称。')
      return
    }
    setIsSavingLocation(true)
    setMessage('')
    try {
      const { supabase } = await import('../../lib/supabase')
      const { error } = await supabase
        .from('storage_locations')
        .insert({ household_id: householdId, room_id: roomId, name })
      if (error) throw error
      event.currentTarget.reset()
      await load()
    } catch {
      setMessage('无法保存存放点；同一房间内请使用不同名称。')
    } finally {
      setIsSavingLocation(false)
    }
  }

  async function replacePhoto(locationId: string, file: File) {
    if (!householdId) return
    setUploadingLocationId(locationId)
    setMessage('')
    try {
      const imagePath = await uploadLocationPhoto(householdId, locationId, file)
      const { supabase } = await import('../../lib/supabase')
      const { error } = await supabase.from('storage_locations').update({ photo_path: imagePath }).eq('id', locationId)
      if (error) throw error
      await load()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法上传位置照片，请重试。')
    } finally {
      setUploadingLocationId(null)
    }
  }

  return <main>
    <header><h1>位置</h1><p>用房间和存放点记录物品放在哪里。</p></header>
    {message ? <p role="alert">{message}</p> : null}
    <section aria-labelledby="rooms-heading">
      <h2 id="rooms-heading">房间</h2>
      <form onSubmit={createRoom}>
        <label>新房间<input name="room" placeholder="厨房" required /></label>
        <button type="submit" disabled={isSavingRoom || !householdId}>{isSavingRoom ? '正在保存…' : '添加房间'}</button>
      </form>
      {!isLoading && rooms.length > 0 ? <ul>{rooms.map((room) => <li key={room.id}>{room.name}</li>)}</ul> : null}
    </section>
    <section aria-labelledby="locations-new-heading">
      <h2 id="locations-new-heading">新增存放点</h2>
      <form onSubmit={createLocation}>
        <label>房间<select name="roomId" defaultValue="" required disabled={rooms.length === 0}><option value="" disabled>{rooms.length === 0 ? '请先添加房间' : '选择房间'}</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>
        <label>存放点<input name="location" placeholder="橱柜" required /></label>
        <button type="submit" disabled={isSavingLocation || !householdId || rooms.length === 0}>{isSavingLocation ? '正在保存…' : '添加存放点'}</button>
      </form>
    </section>
    <section aria-labelledby="locations-heading">
      <h2 id="locations-heading">存放位置</h2>
      {isLoading ? <p>正在读取位置…</p> : locations.length === 0 ? <p>还没有存放点。</p> : <ul>{locations.map((location) => <li key={location.id} className="location-row"><strong>{location.rooms[0]?.name ?? '未设置房间'} / {location.name}</strong>{photoUrls[location.id] ? <img src={photoUrls[location.id] ?? undefined} alt={`${location.rooms[0]?.name ?? '未设置房间'} ${location.name}示意图`} /> : <small>尚未添加示意照片</small>}<label>位置照片<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={uploadingLocationId === location.id} onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ''; if (file) void replacePhoto(location.id, file) }} /></label>{uploadingLocationId === location.id ? <small>正在上传…</small> : null}</li>)}</ul>}
    </section>
  </main>
}
