import { useEffect } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useHouseholdRealtime() {
  useEffect(() => {
    let channel: RealtimeChannel | undefined
    void (async () => {
      const { supabase } = await import('../../lib/supabase')
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) return
      const { data: profile } = await supabase.from('profiles').select('household_id').eq('id', userData.user.id).single()
      if (!profile) return
      channel = supabase.channel(`household-inventory-${profile.household_id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `household_id=eq.${profile.household_id}` }, () => window.dispatchEvent(new Event('inventory-updated')))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_events', filter: `household_id=eq.${profile.household_id}` }, () => window.dispatchEvent(new Event('inventory-updated')))
        .subscribe()
    })().catch(() => undefined)
    return () => { if (channel) void channel.unsubscribe() }
  }, [])
}
