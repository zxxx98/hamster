import { expect, it } from 'vitest'
import { resolveSupabaseConfig } from './supabase'

it('prefers same-origin runtime configuration', () => {
  expect(resolveSupabaseConfig(
    { supabaseUrl: 'https://inventory.example.test', anonKey: 'public-anon-key' },
    undefined,
  )).toEqual({ url: 'https://inventory.example.test', anonKey: 'public-anon-key' })
})

it('falls back to Vite configuration for local development', () => {
  expect(resolveSupabaseConfig(undefined, {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_ANON_KEY: 'dev-anon-key',
  })).toEqual({ url: 'http://localhost:54321', anonKey: 'dev-anon-key' })
})

it('rejects a missing public configuration', () => {
  expect(() => resolveSupabaseConfig(undefined, {})).toThrow('缺少 Supabase 公共配置。')
})
