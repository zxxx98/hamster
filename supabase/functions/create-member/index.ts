import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json, parseCredentials } from '../_shared/validation.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('Supabase function environment is incomplete')
}

const userClient = createClient(supabaseUrl, anonKey)
const serviceClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (request) => {
  const preflight = corsPreflight(request)
  if (preflight) {
    return preflight
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return json({ error: 'Authentication required' }, 401)
  }

  const { data: userData, error: userError } = await userClient.auth.getUser(
    authorization.slice('Bearer '.length),
  )
  if (userError || !userData.user) {
    return json({ error: 'Authentication required' }, 401)
  }

  let requestBody: unknown
  try {
    requestBody = await request.json()
  } catch {
    return json({ error: 'Invalid member details' }, 400)
  }

  const credentials = parseCredentials(requestBody)
  if (!credentials) {
    return json({ error: 'Invalid member details' }, 400)
  }

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('household_id')
    .eq('id', userData.user.id)
    .maybeSingle()
  if (profileError || !profile) {
    return json({ error: 'Creator access required' }, 403)
  }

  const { data: household, error: householdError } = await serviceClient
    .from('households')
    .select('created_by')
    .eq('id', profile.household_id)
    .maybeSingle()
  if (householdError || household?.created_by !== userData.user.id) {
    return json({ error: 'Creator access required' }, 403)
  }

  const { data: createdUser, error: createUserError } = await serviceClient.auth.admin.createUser({
    email: `${credentials.username}@member.local`,
    password: credentials.token,
    email_confirm: true,
  })
  if (createUserError || !createdUser.user) {
    return json({ error: 'Member account could not be created' }, 409)
  }

  const { error: createProfileError } = await serviceClient.from('profiles').insert({
    id: createdUser.user.id,
    household_id: profile.household_id,
    display_name: credentials.username,
  })
  if (createProfileError) {
    await serviceClient.auth.admin.deleteUser(createdUser.user.id)
    return json({ error: 'Member account could not be created' }, 500)
  }

  return json({ id: createdUser.user.id, username: credentials.username }, 201)
})
