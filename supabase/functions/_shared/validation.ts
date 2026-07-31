export const usernamePattern = /^[a-z0-9_-]{3,32}$/

export type Credentials = {
  username: string
  token: string
}

export function parseCredentials(value: unknown): Credentials | null {
  if (!isRecord(value)) {
    return null
  }

  const { username, token } = value

  if (
    typeof username !== 'string' ||
    typeof token !== 'string' ||
    !usernamePattern.test(username) ||
    token.length < 16
  ) {
    return null
  }

  return { username, token }
}

export function json(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-initial-setup-secret',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  })
}

export function corsPreflight(request: Request) {
  if (request.method === 'OPTIONS') {
    return json({}, 204)
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
