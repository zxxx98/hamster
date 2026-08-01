import { supabase } from '../../lib/supabase'
import { validateCredentials } from './api'

type BootstrapClient = {
  functions: {
    invoke: (name: string, options: {
      body: { householdName: string; username: string; token: string }
      headers: Record<string, string>
    }) => Promise<{ data: unknown; error: unknown }>
  }
}

export type InitialSetupInput = {
  householdName: string
  username: string
  token: string
  setupSecret: string
}

export async function bootstrapInitialHousehold(
  client: BootstrapClient = supabase,
  input: InitialSetupInput,
) {
  const householdName = input.householdName.trim()
  const setupSecret = input.setupSecret.trim()

  validateCredentials(input.username, input.token)
  if (!householdName) {
    throw new Error('请输入家庭名称。')
  }
  if (!setupSecret) {
    throw new Error('请输入初始化密钥。')
  }

  const { data, error } = await client.functions.invoke('bootstrap-household', {
    body: { householdName, username: input.username, token: input.token },
    headers: { 'x-initial-setup-secret': setupSecret },
  })

  if (error) {
    throw error
  }

  return data as { id: string; username: string }
}
