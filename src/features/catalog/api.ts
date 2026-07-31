export type BarcodeProduct = {
  name: string
  brand: string | null
  specification: string | null
  imageUrl: string | null
}

export function normalizeBarcodeProduct(input: {
  name?: string
  goodsName?: string
  brand?: string
  spec?: string
  standard?: string
  image?: string
}): BarcodeProduct {
  return {
    name: input.name ?? input.goodsName ?? '',
    brand: input.brand ?? null,
    specification: input.spec ?? input.standard ?? null,
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
