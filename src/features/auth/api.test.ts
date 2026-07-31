import { describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))

import { restoreSession } from './api'

describe('restoreSession', () => {
  it('returns null when Supabase has no saved session', async () => {
    const client = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
      },
    }

    await expect(restoreSession(client)).resolves.toBeNull()
  })
})
