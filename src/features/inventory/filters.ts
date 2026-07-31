export type InventoryFilterRow = {
  quantity: number
  low_stock_threshold: number
  products: { category: string | null }[]
  storage_locations: { id: string; room_id: string }[]
}

export type InventoryFilters = {
  roomId: string
  locationId: string
  category: string
  lowStockOnly: boolean
}

export function filterInventory<T extends InventoryFilterRow>(rows: T[], filters: InventoryFilters): T[] {
  return rows.filter((row) => {
    const location = row.storage_locations[0]
    return (!filters.roomId || location?.room_id === filters.roomId)
      && (!filters.locationId || location?.id === filters.locationId)
      && (!filters.category || row.products[0]?.category === filters.category)
      && (!filters.lowStockOnly || row.quantity <= row.low_stock_threshold)
  })
}
