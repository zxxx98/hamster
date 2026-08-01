import { createClient } from '@supabase/supabase-js'

type PublicSupabaseConfig = {
  supabaseUrl: string
  anonKey: string
}

type ViteSupabaseConfig = Partial<{
  VITE_SUPABASE_URL: string
  VITE_SUPABASE_ANON_KEY: string
}>

export function resolveSupabaseConfig(
  runtimeConfig: PublicSupabaseConfig | undefined,
  viteConfig: ViteSupabaseConfig | undefined,
) {
  const url = runtimeConfig?.supabaseUrl || viteConfig?.VITE_SUPABASE_URL
  const anonKey = runtimeConfig?.anonKey || viteConfig?.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('缺少 Supabase 公共配置。')
  }

  return { url, anonKey }
}

const runtimeConfig = typeof window === 'undefined'
  ? undefined
  : (window as Window & { __HAMSTER_CONFIG__?: PublicSupabaseConfig }).__HAMSTER_CONFIG__

const config = resolveSupabaseConfig(runtimeConfig, import.meta.env as ViteSupabaseConfig)

export const supabase = createClient(config.url, config.anonKey)
