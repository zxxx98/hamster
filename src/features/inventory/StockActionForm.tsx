import { FormEvent, useState } from 'react'
import type { StockAction } from '../../domain/inventory'

export function StockActionForm({ quantity, onAction }: { quantity: number; onAction: (action: StockAction) => Promise<void> }) {
  const [kind, setKind] = useState<'restock' | 'consume' | 'deplete'>('consume')
  const [amount, setAmount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(null)
    if (kind === 'consume' && amount > quantity && !window.confirm(`库存只有 ${quantity}，仍要取用并清零吗？`)) return
    setBusy(true)
    try { await onAction(kind === 'deplete' ? { type: 'deplete' } : { type: kind, amount }); setAmount(1) } catch { setMessage('操作失败，请重试。') } finally { setBusy(false) }
  }
  return <form onSubmit={submit}><label>操作<select value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="restock">补货</option><option value="consume">取用</option><option value="deplete">用完</option></select></label>{kind !== 'deplete' ? <label>数量<input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></label> : null}{message ? <p role="alert">{message}</p> : null}<button disabled={busy}>{busy ? '正在更新…' : kind === 'restock' ? '确认补货' : kind === 'consume' ? '确认取用' : '确认用完'}</button></form>
}
