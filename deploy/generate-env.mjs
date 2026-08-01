import { createHmac, randomBytes as nodeRandomBytes } from 'node:crypto'

const BASE64_URL = 'base64url'

function randomHex(randomBytes, size = 32) {
  return randomBytes(size).toString('hex')
}

function randomBase64Url(randomBytes, size = 32) {
  return randomBytes(size).toString(BASE64_URL)
}

function normalizeAppOrigin(appOrigin) {
  let url

  try {
    url = new URL(appOrigin)
  } catch {
    throw new Error('APP_ORIGIN 必须是 HTTP(S) URL。')
  }

  if (
    !['http:', 'https:'].includes(url.protocol)
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash
  ) {
    throw new Error('APP_ORIGIN 必须是 HTTP(S) URL。')
  }

  return url.origin
}

function normalizeAppPort(appPort) {
  const port = Number(appPort)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('APP_PORT 必须是 1 到 65535 的端口号。')
  }

  return String(port)
}

function encodeBase64Url(value) {
  return Buffer.from(JSON.stringify(value)).toString(BASE64_URL)
}

function createJwt(secret, role) {
  const now = Math.floor(Date.now() / 1000)
  const header = encodeBase64Url({ alg: 'HS256', typ: 'JWT' })
  const payload = encodeBase64Url({
    role,
    iss: 'supabase',
    iat: now,
    exp: now + 60 * 60 * 24 * 3650,
  })
  const signed = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(signed).digest(BASE64_URL)

  return `${signed}.${signature}`
}

export function createDeploymentEnvironment({
  appOrigin = 'http://localhost:24000',
  appPort = '24000',
  randomBytes = nodeRandomBytes,
} = {}) {
  const origin = normalizeAppOrigin(appOrigin)
  const port = normalizeAppPort(appPort)
  const jwtSecret = randomHex(randomBytes)

  return {
    APP_ORIGIN: origin,
    APP_PORT: port,
    POSTGRES_HOST: 'db',
    POSTGRES_PORT: '5432',
    POSTGRES_DB: 'postgres',
    POSTGRES_PASSWORD: randomBase64Url(randomBytes),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRY: '3600',
    ANON_KEY: createJwt(jwtSecret, 'anon'),
    SERVICE_ROLE_KEY: createJwt(jwtSecret, 'service_role'),
    DASHBOARD_USERNAME: 'supabase',
    DASHBOARD_PASSWORD: randomBase64Url(randomBytes),
    SECRET_KEY_BASE: randomBase64Url(randomBytes, 64),
    VAULT_ENC_KEY: randomHex(randomBytes, 16),
    PG_META_CRYPTO_KEY: randomBase64Url(randomBytes),
    REALTIME_DB_ENC_KEY: randomBase64Url(randomBytes, 12),
    POOLER_TENANT_ID: '1000',
    POOLER_DEFAULT_POOL_SIZE: '20',
    POOLER_MAX_CLIENT_CONN: '100',
    POOLER_DB_POOL_SIZE: '5',
    STUDIO_DEFAULT_ORGANIZATION: 'Hamster',
    STUDIO_DEFAULT_PROJECT: 'Hamster',
    OPENAI_API_KEY: '',
    SUPABASE_PUBLIC_URL: origin,
    SUPABASE_PUBLISHABLE_KEY: '',
    SUPABASE_SECRET_KEY: '',
    API_EXTERNAL_URL: `${origin}/auth/v1`,
    SITE_URL: origin,
    ADDITIONAL_REDIRECT_URLS: `${origin}/**`,
    DISABLE_SIGNUP: 'false',
    ENABLE_EMAIL_SIGNUP: 'true',
    ENABLE_EMAIL_AUTOCONFIRM: 'true',
    ENABLE_ANONYMOUS_USERS: 'false',
    ENABLE_PHONE_SIGNUP: 'false',
    ENABLE_PHONE_AUTOCONFIRM: 'false',
    SMTP_ADMIN_EMAIL: 'admin@example.com',
    SMTP_HOST: 'mail',
    SMTP_PORT: '2500',
    SMTP_USER: 'unused',
    SMTP_PASS: 'unused',
    SMTP_SENDER_NAME: 'Hamster',
    MAILER_URLPATHS_INVITE: '/auth/v1/verify',
    MAILER_URLPATHS_CONFIRMATION: '/auth/v1/verify',
    MAILER_URLPATHS_RECOVERY: '/auth/v1/verify',
    MAILER_URLPATHS_EMAIL_CHANGE: '/auth/v1/verify',
    PGRST_DB_SCHEMAS: 'public,storage,graphql_public',
    FUNCTIONS_VERIFY_JWT: 'false',
    IMGPROXY_AUTO_WEBP: 'true',
    GLOBAL_S3_BUCKET: 'stub',
    S3_PROTOCOL_ACCESS_KEY_ID: '',
    S3_PROTOCOL_ACCESS_KEY_SECRET: '',
    STORAGE_TENANT_ID: 'stub',
    REGION: 'local',
    INITIAL_SETUP_SECRET: randomHex(randomBytes),
    FREE_API_APP_ID: '',
    FREE_API_APP_SECRET: '',
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const environment = createDeploymentEnvironment({
    appOrigin: process.env.APP_ORIGIN,
    appPort: process.env.APP_PORT,
  })
  process.stdout.write(`${Object.entries(environment)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')}\n`)
}
