import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from './api'
import { bootstrapInitialHousehold } from './initialSetup'

type InitialSetupPageProps = {
  onSession: () => void
}

const validationMessages = new Set([
  '账号需为 3–32 位小写字母、数字、下划线或连字符。',
  'Token 至少需要 16 个字符。',
  '请输入家庭名称。',
  '请输入初始化密钥。',
])

function errorStatus(error: unknown) {
  if (typeof error !== 'object' || error === null) return null

  const possibleError = error as { status?: unknown; context?: { status?: unknown } }
  if (typeof possibleError.status === 'number') return possibleError.status
  if (typeof possibleError.context?.status === 'number') return possibleError.context.status
  return null
}

function setupErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (validationMessages.has(message)) return message

  switch (errorStatus(error)) {
    case 401:
      return '初始化密钥不正确。'
    case 409:
      return '该服务器已经完成初始化，请直接登录。'
    case 503:
      return '初始化暂不可用，请联系服务器管理员。'
    default:
      return '无法创建家庭，请稍后重试。'
  }
}

export function InitialSetupPage({ onSession }: InitialSetupPageProps) {
  const navigate = useNavigate()
  const [householdName, setHouseholdName] = useState('我的家庭')
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await bootstrapInitialHousehold(undefined, { householdName, username, token, setupSecret })
      await signIn(username, token)
      setToken('')
      setSetupSecret('')
      onSession()
      navigate('/', { replace: true })
    } catch (error) {
      setErrorMessage(setupErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="setup-page">
      <header>
        <p>家藏</p>
        <h1>创建家庭库存</h1>
        <p>仅在首次部署时创建家庭与管理账号。</p>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <p>
          <label htmlFor="household-name">家庭名称</label>
          <input
            id="household-name"
            name="householdName"
            value={householdName}
            onChange={(event) => setHouseholdName(event.target.value)}
            required
          />
        </p>
        <p>
          <label htmlFor="setup-username">创建者账号</label>
          <input
            id="setup-username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </p>
        <p>
          <label htmlFor="setup-token">创建者 Token</label>
          <input
            id="setup-token"
            name="token"
            type="password"
            autoComplete="new-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </p>
        <p>
          <label htmlFor="setup-secret">初始化密钥</label>
          <input
            id="setup-secret"
            name="setupSecret"
            type="password"
            autoComplete="off"
            value={setupSecret}
            onChange={(event) => setSetupSecret(event.target.value)}
            required
          />
          <small>此密钥仅用于本次首次安装，不会保存到浏览器。</small>
        </p>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '正在创建…' : '创建家庭'}
        </button>
        <p className="setup-login-link"><Link to="/login">已完成初始化？去登录</Link></p>
      </form>
    </main>
  )
}
