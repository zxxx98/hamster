export type StockAction =
  | { type: 'restock'; amount: number }
  | { type: 'consume'; amount: number }
  | { type: 'deplete' }

type ReminderStateInput = {
  quantity: number
  threshold: number
  ignored: boolean
}

export function applyStockAction(quantity: number, action: StockAction): number {
  assertNonNegativeInteger(quantity, 'quantity')

  switch (action.type) {
    case 'restock':
      assertPositiveInteger(action.amount, 'amount')
      return quantity + action.amount
    case 'consume':
      assertPositiveInteger(action.amount, 'amount')
      return Math.max(0, quantity - action.amount)
    case 'deplete':
      return 0
  }
}

export function reminderState({
  quantity,
  threshold,
  ignored,
}: ReminderStateInput): 'active' | 'ignored' | 'clear' {
  if (quantity > threshold) {
    return 'clear'
  }

  return ignored ? 'ignored' : 'active'
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
}

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
}
