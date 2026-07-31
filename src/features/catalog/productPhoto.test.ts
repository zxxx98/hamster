import { expect, it } from 'vitest'
import { productPhotoPath, validateProductPhoto } from './productPhoto'

it('keeps a product photo in its household storage prefix', () => {
  expect(productPhotoPath('household-1', 'product-2', 'camera.jpg'))
    .toBe('household-1/products/product-2/camera.jpg')
})

it('rejects unsupported image types', () => {
  expect(() => validateProductPhoto(new File(['x'], 'camera.gif', { type: 'image/gif' }))).toThrow()
})
