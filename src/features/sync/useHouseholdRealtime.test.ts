import { expect, it } from 'vitest'
import { householdRealtimeTables } from './useHouseholdRealtime'

it('subscribes to every MVP shared table that can change a joined inventory view', () => {
  expect(householdRealtimeTables).toEqual([
    'inventory_items', 'inventory_events', 'products', 'rooms', 'storage_locations',
  ])
})
