import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signIn } from './api'

type LoginPageProps = {
  onSession: () => void
}

export function LoginPage({ onSession }: LoginPageProps) {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [token, setToken] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await signIn(username, token)
      onSession()
      navigate('/', { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setErrorMessage(
        message === '账号需为 3–32 位小写字母、数字、下划线或连字符。' ||
          message === 'Token 至少需要 16 个字符。'
          ? message
          : '账号或 Token 不正确，请确认后重试。',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main>
      <header>
        <p>家藏</p>
        <h1>登录家庭库存</h1>
        <p>首次登录请输入创建者提供的账号和 Token。</p>
      </header>

      <form onSubmit={handleSubmit} noValidate>
        <p>
          <label htmlFor="username">账号</label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </p>
        <p>
          <label htmlFor="token">Token</label>
          <input
            id="token"
            name="token"
            type="password"
            autoComplete="current-password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            required
          />
        </p>
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? '正在登录…' : '登录'}
        </button>
      </form>
    </main>
  )
}
