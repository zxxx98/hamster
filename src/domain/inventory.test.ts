import { describe, expect, it } from 'vitest'
import { applyStockAction, reminderState } from './inventory'

describe('applyStockAction', () => {
  it('adds restocked units to the current quantity', () => {
    expect(applyStockAction(3, { type: 'restock', amount: 4 })).toBe(7)
  })

  it('consumes units without reducing the quantity below zero', () => {
    expect(applyStockAction(3, { type: 'consume', amount: 4 })).toBe(0)
  })

  it('sets the quantity to zero when depleted', () => {
    expect(applyStockAction(3, { type: 'deplete' })).toBe(0)
  })

  it('rejects a quantity that is not a non-negative integer', () => {
    expect(() => applyStockAction(-1, { type: 'deplete' })).toThrow(
      'quantity must be a non-negative integer',
    )
  })

  it('rejects non-positive restock and consume amounts', () => {
    expect(() => applyStockAction(3, { type: 'restock', amount: 0 })).toThrow(
      'amount must be a positive integer',
    )
    expect(() => applyStockAction(3, { type: 'consume', amount: -1 })).toThrow(
      'amount must be a positive integer',
    )
  })
})

describe('reminderState', () => {
  it('is active when quantity is at or below the threshold and not ignored', () => {
    expect(reminderState({ quantity: 2, threshold: 2, ignored: false })).toBe('active')
  })

  it('is ignored when quantity is at or below the threshold and ignored', () => {
    expect(reminderState({ quantity: 1, threshold: 2, ignored: true })).toBe('ignored')
  })

  it('is clear above the threshold even when previously ignored', () => {
    expect(reminderState({ quantity: 3, threshold: 2, ignored: true })).toBe('clear')
  })
})
