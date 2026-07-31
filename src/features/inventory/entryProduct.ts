export type EntryProductInput = {
  name: string
  barcode: string | null
  brand: string | null
  specification: string | null
  category: string | null
}

type Product = { id: string }

type ProductRepository = {
  findByBarcode: (householdId: string, barcode: string) => Promise<Product | null>
  create: (householdId: string, input: EntryProductInput) => Promise<Product>
}

const isUniqueViolation = (error: unknown): error is { code: string } =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'

export async function resolveEntryProduct(
  repository: ProductRepository,
  householdId: string,
  input: EntryProductInput,
) {
  const barcode = input.barcode?.trim() || null

  if (barcode) {
    const existing = await repository.findByBarcode(householdId, barcode)
    if (existing) return { product: existing, wasCreated: false }
  }

  try {
    const product = await repository.create(householdId, { ...input, barcode })
    return { product, wasCreated: true }
  } catch (error) {
    if (!barcode || !isUniqueViolation(error)) throw error

    const existing = await repository.findByBarcode(householdId, barcode)
    if (existing) return { product: existing, wasCreated: false }
    throw error
  }
}
