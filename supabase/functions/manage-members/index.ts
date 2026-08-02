import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsPreflight, json } from '../_shared/validation.ts'
import { parseMemberAction } from '../_shared/memberManagement.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Supabase function environment is incomplete')

const userClient = createClient(supabaseUrl, anonKey)
const serviceClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (request) => {
  const preflight = corsPreflight(request)
  if (preflight) return preflight
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required' }, 401)
  const { data: userData, error: userError } = await userClient.auth.getUser(authorization.slice('Bearer '.length))
  if (userError || !userData.user) return json({ error: 'Authentication required' }, 401)

  let action
  try { action = parseMemberAction(await request.json()) } catch { action = null }
  if (!action) return json({ error: 'Invalid member details' }, 400)

  const { data: caller, error: callerError } = await serviceClient
    .from('profiles').select('household_id').eq('id', userData.user.id).maybeSingle()
  if (callerError || !caller) return json({ error: 'Creator access required' }, 403)
  const { data: household, error: householdError } = await serviceClient
    .from('households').select('created_by').eq('id', caller.household_id).maybeSingle()
  if (householdError || household?.created_by !== userData.user.id) return json({ error: 'Creator access required' }, 403)

  if (action.action === 'list') {
    const { data, error } = await serviceClient.from('profiles').select('id, display_name').eq('household_id', caller.household_id).order('created_at')
    if (error) return json({ error: 'Unable to read members' }, 500)
    return json((data ?? []).map((member) => ({ id: member.id, username: member.display_name, isCreator: member.id === household.created_by })))
  }

  if (action.action === 'create') {
    const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
      email: `${action.username}@member.local`, password: action.token, email_confirm: true,
    })
    if (createError || !created.user) return json({ error: 'Member account could not be created' }, 409)
    const { error: profileError } = await serviceClient.from('profiles').insert({ id: created.user.id, household_id: caller.household_id, display_name: action.username })
    if (profileError) {
      await serviceClient.auth.admin.deleteUser(created.user.id)
      return json({ error: 'Member account could not be created' }, 500)
    }
    return json({ id: created.user.id, username: action.username, isCreator: false }, 201)
  }

  if (action.id === household.created_by) return json({ error: 'The household creator cannot be changed or deleted' }, 403)
  const { data: target, error: targetError } = await serviceClient
    .from('profiles').select('id, display_name').eq('id', action.id).eq('household_id', caller.household_id).maybeSingle()
  if (targetError || !target) return json({ error: 'Member not found' }, 404)

  if (action.action === 'delete') {
    const { error } = await serviceClient.auth.admin.deleteUser(target.id)
    return error ? json({ error: 'Member could not be deleted' }, 500) : json({}, 204)
  }

  const attributes: { email?: string; password?: string } = {}
  if (target.display_name !== action.username) attributes.email = `${action.username}@member.local`
  if (action.token) attributes.password = action.token
  if (Object.keys(attributes).length) {
    const { error } = await serviceClient.auth.admin.updateUserById(target.id, attributes)
    if (error) return json({ error: 'Member account could not be updated' }, 409)
  }
  if (target.display_name !== action.username) {
    const { error } = await serviceClient.from('profiles').update({ display_name: action.username }).eq('id', target.id)
    if (error) return json({ error: 'Member account could not be updated' }, 500)
  }
  return json({ id: target.id, username: action.username, isCreator: false })
})
