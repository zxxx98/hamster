import { expect, it } from 'vitest'
import { filterInventory } from './filters'

const rows = [
  { quantity: 1, low_stock_threshold: 1, products: [{ category: '纸品' }], storage_locations: [{ id: 'location-kitchen', room_id: 'room-kitchen' }] },
  { quantity: 5, low_stock_threshold: 1, products: [{ category: '清洁' }], storage_locations: [{ id: 'location-bathroom', room_id: 'room-bathroom' }] },
  { quantity: 5, low_stock_threshold: 1, products: [{ category: '纸品' }], storage_locations: [{ id: 'location-bedroom', room_id: 'room-bedroom' }] },
]

const kitchenPaperLowStock = {
  roomId: 'room-kitchen', locationId: 'location-kitchen', category: '纸品', lowStockOnly: true,
}

it('keeps an item that matches every inventory filter', () => {
  expect(filterInventory(rows, kitchenPaperLowStock)).toEqual([rows[0]])
})

it('excludes a row in another room', () => {
  expect(filterInventory(rows, { ...kitchenPaperLowStock, lowStockOnly: false })).not.toContain(rows[1])
})

it('excludes a healthy row when low-stock-only is enabled', () => {
  expect(filterInventory(rows, { ...kitchenPaperLowStock, roomId: '', locationId: '' })).not.toContain(rows[2])
})
