import { expect, it, vi } from 'vitest'
import { resolveEntryProduct } from './entryProduct'

const input = {
  name: '清风抽纸',
  barcode: '6900000000001',
  brand: '清风',
  specification: '3 层 100 抽',
  category: '纸品',
}

it('reuses an existing household product for a matching barcode', async () => {
  const findByBarcode = vi.fn().mockResolvedValue({ id: 'product-existing' })
  const create = vi.fn()

  await expect(resolveEntryProduct({ findByBarcode, create }, 'household-1', input))
    .resolves.toEqual({ product: { id: 'product-existing' }, wasCreated: false })

  expect(create).not.toHaveBeenCalled()
})

it('creates a product when the household has no matching barcode', async () => {
  const create = vi.fn().mockResolvedValue({ id: 'product-new' })

  await expect(resolveEntryProduct(
    { findByBarcode: vi.fn().mockResolvedValue(null), create },
    'household-1',
    input,
  )).resolves.toEqual({ product: { id: 'product-new' }, wasCreated: true })

  expect(create).toHaveBeenCalledWith('household-1', input)
})

it('creates manual entries without looking up an empty barcode', async () => {
  const findByBarcode = vi.fn()
  const create = vi.fn().mockResolvedValue({ id: 'product-manual' })

  await resolveEntryProduct({ findByBarcode, create }, 'household-1', { ...input, barcode: '' })

  expect(findByBarcode).not.toHaveBeenCalled()
  expect(create).toHaveBeenCalledWith('household-1', { ...input, barcode: null })
})

it('reuses the winner when a concurrent entry creates the same barcode', async () => {
  const findByBarcode = vi.fn()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ id: 'product-winner' })
  const create = vi.fn().mockRejectedValue({ code: '23505' })

  await expect(resolveEntryProduct({ findByBarcode, create }, 'household-1', input))
    .resolves.toEqual({ product: { id: 'product-winner' }, wasCreated: false })

  expect(findByBarcode).toHaveBeenCalledTimes(2)
})
