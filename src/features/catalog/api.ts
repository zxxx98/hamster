export type BarcodeProduct = {
  name: string
  brand: string | null
  specification: string | null
  imageUrl: string | null
}

export function normalizeBarcodeProduct(input: {
  name?: string
  brand?: string
  spec?: string
  image?: string
}): BarcodeProduct {
  return {
    name: input.name ?? '',
    brand: input.brand ?? null,
    specification: input.spec ?? null,
    imageUrl: input.image ?? null,
  }
}

export async function lookupBarcode(
  code: string,
  client?: { functions: { invoke: (name: string, options: { body: { code: string } }) => Promise<{ data: unknown; error: unknown }> } },
) {
  const activeClient = client ?? (await import('../../lib/supabase')).supabase
  const { data, error } = await activeClient.functions.invoke('lookup-barcode', { body: { code } })
  if (error) throw error
  return data as { found: boolean; product?: BarcodeProduct }
}
