export const productPhotoPath = (householdId: string, productId: string, filename: string) =>
  `${householdId}/products/${productId}/${filename}`

export function validateProductPhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('图片须为 JPG、PNG 或 WebP')
  }
  if (file.size > 5_000_000) throw new Error('图片不能超过 5 MB')
}

export async function uploadProductPhoto(householdId: string, productId: string, file: File) {
  validateProductPhoto(file)
  const { supabase } = await import('../../lib/supabase')
  const path = productPhotoPath(householdId, productId, file.name)
  const { error } = await supabase.storage.from('location-photos').upload(path, file, { upsert: true })
  if (error) throw error
  return path
}
