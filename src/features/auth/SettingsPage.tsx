import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createMember, deleteMember, listMembers, type ManagedMember, updateMember } from './api'

export function SettingsPage() {
  const [members, setMembers] = useState<ManagedMember[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<ManagedMember | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editToken, setEditToken] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try { setMembers(await listMembers()); setError(null) } catch { setError('无法读取家庭成员。仅家庭创建者可以操作。') }
  }, [])
  useEffect(() => { void load() }, [load])

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    setBusy(true); setError(null)
    try {
      const member = await createMember(String(data.get('username') ?? ''), String(data.get('token') ?? ''))
      setMembers((current) => [...current, member])
      form.reset()
    } catch { setError('无法创建成员，请检查账号与 Token。') } finally { setBusy(false) }
  }

  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing) return
    setBusy(true); setError(null)
    try {
      const member = await updateMember({ id: editing.id, username: editUsername, ...(editToken ? { token: editToken } : {}) })
      setMembers((current) => current.map((item) => item.id === member.id ? member : item))
      setEditing(null); setEditToken('')
    } catch { setError('无法更新成员，请检查账号与 Token。') } finally { setBusy(false) }
  }

  async function removeMember(member: ManagedMember) {
    if (!window.confirm(`确定删除成员 ${member.username} 吗？此操作不可恢复。`)) return
    setBusy(true); setError(null)
    try { await deleteMember(member.id); setMembers((current) => current.filter((item) => item.id !== member.id)) } catch { setError('无法删除成员，请重试。') } finally { setBusy(false) }
  }

  return <main>
    <header><h1>设置</h1><p>管理家庭成员及其登录凭据。</p></header>
    {error ? <p role="alert">{error}</p> : null}
    <section aria-labelledby="members-heading">
      <h2 id="members-heading">家庭成员</h2>
      {members.length === 0 ? <p>正在读取成员…</p> : <ul>{members.map((member) => <li key={member.id} className="settings-member-row"><strong>{member.username}</strong>{member.isCreator ? <small>创建者</small> : <div className="settings-member-actions"><button type="button" disabled={busy} onClick={() => { setEditing(member); setEditUsername(member.username); setEditToken('') }}>编辑 {member.username}</button><button type="button" disabled={busy} onClick={() => void removeMember(member)}>删除 {member.username}</button></div>}{editing?.id === member.id ? <form className="settings-member-editor" onSubmit={saveMember}><label>账号<input value={editUsername} onChange={(event) => setEditUsername(event.target.value)} required /></label><label>{member.username} 的新 Token<input type="password" value={editToken} onChange={(event) => setEditToken(event.target.value)} placeholder="留空则不修改" /></label><button disabled={busy}>{busy ? '正在保存…' : `保存 ${member.username}`}</button></form> : null}</li>)}</ul>}
    </section>
    <section aria-labelledby="new-member-heading">
      <h2 id="new-member-heading">新增成员</h2>
      <form onSubmit={addMember}><label>账号<input name="username" required /></label><label>初始 Token<input name="token" type="password" minLength={16} required /></label><button disabled={busy}>{busy ? '正在创建…' : '创建成员'}</button></form>
    </section>
  </main>
}
