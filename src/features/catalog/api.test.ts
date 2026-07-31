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

it('maps the Free API barcode response without inventing an image', () => {
  expect(normalizeBarcodeProduct({ goodsName: '清风抽纸', brand: '清风', standard: '单包' }))
    .toEqual({ name: '清风抽纸', brand: '清风', specification: '单包', imageUrl: null })
})
