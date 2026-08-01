import { supabase } from '../../lib/supabase'

type SetupStatusClient = {
  functions: {
    invoke: (name: string) => Promise<{ data: unknown; error: unknown }>
  }
}

export async function getInitialSetupStatus(client: SetupStatusClient = supabase) {
  const { data, error } = await client.functions.invoke('initial-setup-status')

  if (error) {
    throw error
  }

  if (
    typeof data !== 'object' ||
    data === null ||
    !('setupRequired' in data) ||
    typeof data.setupRequired !== 'boolean'
  ) {
    throw new Error('初始化状态响应无效。')
  }

  return data.setupRequired
}
