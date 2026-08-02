import { usernamePattern } from './validation.ts'

export type MemberAction =
  | { action: 'list' }
  | { action: 'create'; username: string; token: string }
  | { action: 'update'; id: string; username: string; token?: string }
  | { action: 'delete'; id: string }

export function parseMemberAction(value: unknown): MemberAction | null {
  if (!value || typeof value !== 'object') return null
  const action = (value as Record<string, unknown>).action
  const id = (value as Record<string, unknown>).id
  const username = (value as Record<string, unknown>).username
  const token = (value as Record<string, unknown>).token
  if (action === 'list') return { action }
  if ((action === 'delete' && typeof id === 'string' && id) ) return { action, id }
  if ((action === 'create' || action === 'update') && typeof username === 'string' && usernamePattern.test(username) && (action === 'update' ? typeof id === 'string' && id : true)) {
    if (token !== undefined && (typeof token !== 'string' || token.length < 16)) return null
    if (action === 'create' && token === undefined) return null
    return action === 'create' ? { action, username, token: token as string } : { action, id: id as string, username, ...(token === undefined ? {} : { token: token as string }) }
  }
  return null
}
