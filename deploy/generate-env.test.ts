import { expect, it } from 'vitest'
import { createDeploymentEnvironment } from './generate-env.mjs'

it('creates distinct anon and service JWTs', () => {
  const env = createDeploymentEnvironment({ randomBytes: (size) => Buffer.alloc(size, 7) })

  expect(env.JWT_SECRET).toHaveLength(64)
  expect(env.ANON_KEY).not.toBe(env.SERVICE_ROLE_KEY)
  expect(env.ANON_KEY.split('.')).toHaveLength(3)
  expect(env.INITIAL_SETUP_SECRET).toHaveLength(64)
})

it('derives public URLs from the app origin', () => {
  const env = createDeploymentEnvironment({ appOrigin: 'https://inventory.example.test' })

  expect(env.SUPABASE_PUBLIC_URL).toBe('https://inventory.example.test')
  expect(env.API_EXTERNAL_URL).toBe('https://inventory.example.test/auth/v1')
  expect(env.SITE_URL).toBe('https://inventory.example.test')
  expect(env.ADDITIONAL_REDIRECT_URLS).toBe('https://inventory.example.test/**')
})

it('keeps the published application port independent from a reverse-proxied origin', () => {
  expect(createDeploymentEnvironment({ appOrigin: 'https://inventory.example.test' }).APP_PORT)
    .toBe('24000')
  expect(createDeploymentEnvironment({ appPort: 24123 }).APP_PORT).toBe('24123')
})

it('rejects non-HTTP application origins', () => {
  expect(() => createDeploymentEnvironment({ appOrigin: 'ftp://inventory.example.test' }))
    .toThrow('APP_ORIGIN 必须是 HTTP(S) URL。')
})

it('provides empty optional values required to render the bundled Compose file', () => {
  const env = createDeploymentEnvironment()

  expect(env).toMatchObject({
    OPENAI_API_KEY: '',
    S3_PROTOCOL_ACCESS_KEY_ID: '',
    S3_PROTOCOL_ACCESS_KEY_SECRET: '',
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
  })
})
