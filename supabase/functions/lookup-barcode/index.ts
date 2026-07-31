import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/validation.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const juheKey = Deno.env.get('JUHE_BARCODE_API_KEY')

if (!supabaseUrl || !anonKey) throw new Error('Supabase function environment is incomplete')
const authClient = createClient(supabaseUrl, anonKey)

Deno.serve(async (request) => {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)
  const { data: user } = await authClient.auth.getUser(authorization.slice(7))
  if (!user.user) return json({ error: 'Authentication required' }, 401)
  const body = await request.json().catch(() => null) as { code?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!/^\d{8,14}$/.test(code)) return json({ error: 'Invalid barcode' }, 400)
  if (!juheKey) return json({ found: false })
  const url = new URL('https://apis.juhe.cn/barcode/index')
  url.searchParams.set('key', juheKey)
  url.searchParams.set('barcode', code)
  const response = await fetch(url)
  if (!response.ok) return json({ found: false })
  const payload = await response.json() as { result?: { name?: string; brand?: string; spec?: string; image?: string } }
  if (!payload.result?.name) return json({ found: false })
  return json({ found: true, product: { name: payload.result.name, brand: payload.result.brand ?? null, specification: payload.result.spec ?? null, imageUrl: payload.result.image ?? null } })
})
