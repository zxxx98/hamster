import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { createMember } from './api'

export function MemberManagementPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage(null); try { const member = await createMember(String(form.get('username')), String(form.get('token'))); setMessage(`已创建成员：${member.username}`); event.currentTarget.reset() } catch { setMessage('无法创建成员。仅家庭创建者可以操作，请检查账号与 Token。') } finally { setBusy(false) } }
  return <main><Link to="/">返回库存</Link><h1>家庭成员</h1><p>创建者可在此生成成员账号和首次登录 Token。</p><form onSubmit={submit}><label>账号<input name="username" required /></label><label>初始 Token<input name="token" type="password" minLength={16} required /></label>{message ? <p role="status">{message}</p> : null}<button disabled={busy}>{busy ? '正在创建…' : '创建成员'}</button></form></main>
}
