import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/validation.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Supabase function environment is incomplete')
}

const serviceClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (request) => {
  const preflight = corsPreflight(request)
  if (preflight) {
    return preflight
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const { data: households, error } = await serviceClient
    .from('households')
    .select('id')
    .limit(1)

  if (error || !households) {
    return json({ error: 'Initial setup status is unavailable' }, 503)
  }

  return json({ setupRequired: households.length === 0 })
})
