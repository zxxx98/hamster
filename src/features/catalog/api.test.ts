import { expect, it } from 'vitest'
import { normalizeBarcodeProduct } from './api'

it('maps a provider response to editable product fields', () => {
  expect(
    normalizeBarcodeProduct({
      name: '心相印抽纸',
      brand: '心相印',
      spec: '3层*24包',
      image: 'https://x.test/a.jpg',
    }),
  ).toEqual({
    name: '心相印抽纸',
    brand: '心相印',
    specification: '3层*24包',
    imageUrl: 'https://x.test/a.jpg',
  })
})
