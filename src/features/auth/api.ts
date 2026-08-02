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

export type ManagedMember = { id: string; username: string; isCreator: boolean }

type MemberClient = {
  functions: {
    invoke: (name: string, options: { body: Record<string, string> }) => Promise<{ data: unknown; error: Error | null }>
  }
}

async function manageMembers(client: MemberClient, body: Record<string, string>) {
  const { data, error } = await client.functions.invoke('manage-members', { body })
  if (error) throw error
  return data
}

export async function listMembers(client: MemberClient = supabase) {
  return manageMembers(client, { action: 'list' }) as Promise<ManagedMember[]>
}

export async function createMember(username: string, token: string, client: MemberClient = supabase) {
  validateCredentials(username, token)
  return manageMembers(client, { action: 'create', username, token }) as Promise<ManagedMember>
}

export async function updateMember(input: { id: string; username: string; token?: string }, client: MemberClient = supabase) {
  if (!usernamePattern.test(input.username)) {
    throw new Error('账号需为 3–32 位小写字母、数字、下划线或连字符。')
  }
  if (input.token !== undefined && input.token.length < 16) {
    throw new Error('Token 至少需要 16 个字符。')
  }
  return manageMembers(client, { action: 'update', ...input }) as Promise<ManagedMember>
}

export async function deleteMember(id: string, client: MemberClient = supabase) {
  return manageMembers(client, { action: 'delete', id })
}
