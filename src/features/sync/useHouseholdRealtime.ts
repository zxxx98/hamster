import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

export const householdRealtimeTables = [
  'inventory_items', 'inventory_events', 'products', 'rooms', 'storage_locations',
] as const

export function useHouseholdRealtime(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let channel: RealtimeChannel | undefined
    void (async () => {
      const { supabase } = await import('../../lib/supabase')
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userData.user.id).single()
      if (!profile) return
      channel = supabase.channel(`household-inventory-${profile.household_id}`)
      for (const table of householdRealtimeTables) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `household_id=eq.${profile.household_id}` },
          () => window.dispatchEvent(new Event('household-data-updated')),
        )
      }
      channel.subscribe()
    })().catch(() => undefined)
    return () => { if (channel) void channel.unsubscribe() }
  }, [enabled])
}
