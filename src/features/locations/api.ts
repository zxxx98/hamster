export const locationPhotoPath = (householdId: string, locationId: string, filename: string) =>
  `${householdId}/locations/${locationId}/${filename}`

export async function uploadLocationPhoto(householdId: string, locationId: string, file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
    throw new Error('图片须为 JPG、PNG 或 WebP，且不超过 5 MB')
  }
  const { supabase } = await import('../../lib/supabase')
  const path = locationPhotoPath(householdId, locationId, file.name)
  const { error } = await supabase.storage.from('location-photos').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}
