import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/validation.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const appId = Deno.env.get('FREE_API_APP_ID')
const appSecret = Deno.env.get('FREE_API_APP_SECRET')

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
  if (!appId || !appSecret) return json({ found: false })
  const url = new URL('https://www.mxnzp.com/api/barcode/goods/details')
  url.searchParams.set('barcode', code)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_secret', appSecret)
  const response = await fetch(url)
  if (!response.ok) return json({ found: false })
  const payload = await response.json() as { code?: number; data?: { goodsName?: string; brand?: string; standard?: string } }
  if (payload.code !== 1 || !payload.data?.goodsName) return json({ found: false })
  return json({ found: true, product: { name: payload.data.goodsName, brand: payload.data.brand ?? null, specification: payload.data.standard ?? null, imageUrl: null } })
})
