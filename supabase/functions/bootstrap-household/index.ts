import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json, parseCredentials } from '../_shared/validation.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const initialSetupSecret = Deno.env.get('INITIAL_SETUP_SECRET')

if (!supabaseUrl || !serviceRoleKey || !initialSetupSecret) {
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

  if (request.headers.get('x-initial-setup-secret') !== initialSetupSecret) {
    return json({ error: 'Initial setup is not authorized' }, 401)
  }

  // This precheck only improves the repeated-setup response. The database's
  // singleton index is the concurrency guard for the later insert.
  const { data: households, error: householdsError } = await serviceClient
    .from('households')
    .select('id')
    .limit(1)
  if (householdsError) {
    return json({ error: 'Initial setup is unavailable' }, 500)
  }
  if (households.length > 0) {
    return json({ error: 'A household already exists' }, 409)
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return json({ error: 'Invalid initial account details' }, 400)
  }

  const credentials = parseCredentials(requestBody)
  const householdName =
    typeof requestBody === 'object' && requestBody !== null && typeof requestBody.householdName === 'string'
      ? requestBody.householdName.trim()
      : '我的家庭'
  if (!credentials || householdName.length === 0) {
    return json({ error: 'Invalid initial account details' }, 400)
  }

  const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
    email: `${credentials.username}@member.local`,
    password: credentials.token,
    email_confirm: true,
  })
  if (createUserError || !createdUser.user) {
    return json({ error: 'Initial account could not be created' }, 409)
  }

  const { data: household, error: createHouseholdError } = await serviceClient
    .from('households')
    .insert({ name: householdName, created_by: createdUser.user.id })
    .select('id')
    .single()
  if (createHouseholdError || !household) {
    await serviceClient.auth.admin.deleteUser(createdUser.user.id)
    return json(
      { error: 'Initial setup is unavailable' },
      createHouseholdError?.code === '23505' ? 409 : 500,
    )
  }

  const { error: createProfileError } = await serviceClient.from('profiles').insert({
    id: createdUser.user.id,
    household_id: household.id,
    display_name: credentials.username,
  })
  if (createProfileError) {
    await serviceClient.from('households').delete().eq('id', household.id)
    await serviceClient.auth.admin.deleteUser(createdUser.user.id)
    return json({ error: 'Initial household could not be created' }, 500)
  }

  return json({ id: createdUser.user.id, username: credentials.username }, 201)
})
