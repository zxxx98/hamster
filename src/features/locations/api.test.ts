import { expect, it } from 'vitest'
import { locationPhotoPath, validateLocationPhoto } from './api'

it('keeps a location photo inside the household storage prefix', () => {
  expect(locationPhotoPath('household-1', 'location-2', 'photo.jpg'))
    .toBe('household-1/locations/location-2/photo.jpg')
})

it('rejects an unsupported location photo before upload', () => {
  expect(() => validateLocationPhoto(new File(['x'], 'photo.gif', { type: 'image/gif' }))).toThrow(
    '图片须为 JPG、PNG 或 WebP，且不超过 5 MB',
  )
})
