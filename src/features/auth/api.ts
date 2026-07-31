import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

const usernamePattern = /^[a-z0-9_-]{3,32}$/

type SessionClient = {
  auth: {
    getSession: () => Promise<{
      data: { session: Session | null }
      error: Error | null
    }>
  }
}

export function validateCredentials(username: string, token: string) {
  if (!usernamePattern.test(username)) {
    throw new Error('账号需为 3–32 位小写字母、数字、下划线或连字符。')
  }

  if (token.length < 16) {
    throw new Error('Token 至少需要 16 个字符。')
  }
}

export async function restoreSession(client: SessionClient = supabase) {
  const { data, error } = await client.auth.getSession()

  if (error) {
    throw error
  }

  return data.session
}

export async function signIn(username: string, token: string) {
  validateCredentials(username, token)

  const { data, error } = await supabase.auth.signInWithPassword({
    email: `${username}@member.local`,
    password: token,
  })

  if (error) {
    throw error
  }

  return data
}

export async function createMember(username: string, token: string) {
  validateCredentials(username, token)

  const { data, error } = await supabase.functions.invoke('create-member', {
    body: { username, token },
  })

  if (error) {
    throw error
  }

  return data as { id: string; username: string }
}
