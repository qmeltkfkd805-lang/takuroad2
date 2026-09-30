'use client'

import { useEffect, useRef, useState } from 'react'
import { adminFindUsers, adminTransferRoute } from '@/services/routeService'

type U = { id: string; nickname: string | null; avatar_url?: string | null }

/** 관리자: 루트 작성자 넘기기 — 출처 주인이 가입하면 그분 계정으로 루트를 옮긴다 */
export default function TransferOwnerModal({ routeId, currentOwnerId, currentName, sources, onClose, onDone }: {
  routeId: string
  currentOwnerId?: string | null
  currentName?: string | null
  sources?: { name?: string | null; url?: string | null }[]
  onClose: () => void
  onDone: (nickname: string) => void
}) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<U[]>([])
  const [searching, setSearching] = useState(false)
  const [pick, setPick] = useState<U | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const seq = useRef(0)

  useEffect(() => {
    const t = q.trim()
    if (!t) { setList([]); return }
    const n = ++seq.current
    setSearching(true)
    const h = setTimeout(async () => {
      const r = await adminFindUsers(t)
      if (n === seq.current) { setList(r); setSearching(false) }
    }, 250)
    return () => clearTimeout(h)
  }, [q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function submit() {
    if (!pick || busy) return
    setBusy(true); setErr('')
    const r = await adminTransferRoute(routeId, pick.id)
    setBusy(false)
    if (r.ok) onDone(pick.nickname ?? '회원')
    else setErr(r.error ?? '넘기지 못했어요.')
  }

  const srcNames = (sources ?? []).map(x => x.name || x.url).filter(Boolean) as string[]

  return (
    <div role="dialog" aria-modal="true" aria-label="작성자 넘기기" onClick={() => !busy && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 320, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 440, background: 'var(--surface, #fff)', color: 'var(--text)', borderRadius: 18, padding: 22, boxShadow: '0 12px 40px rgba(0,0,0,.2)', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>작성자 넘기기</div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, margin: '0 0 14px' }}>
          출처 주인이 가입하면 이 루트를 그분 계정으로 옮겨요. 넘긴 뒤에는 그분이 작성자로 보이고, 수정·삭제도 그분이 할 수 있어요.
          {currentName && <><br />지금 작성자: <b style={{ color: 'var(--text)' }}>{currentName}</b></>}
        </p>
        {srcNames.length > 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
            이 루트 출처: <b style={{ color: 'var(--text)' }}>{srcNames.join(', ')}</b>
          </div>
        )}

        {!pick ? (
          <>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="넘겨받을 회원 닉네임 검색"
              style={{ width: '100%', boxSizing: 'border-box', height: 44, borderRadius: 12, border: '1px solid var(--border)', padding: '0 14px', fontSize: 15, background: 'var(--surface, #fff)', color: 'var(--text)' }} />
            <div style={{ marginTop: 10, minHeight: 40 }}>
              {searching && <div style={{ fontSize: 13, color: 'var(--muted)', padding: 8 }}>찾는 중…</div>}
              {!searching && q.trim() && list.length === 0 && <div style={{ fontSize: 13, color: 'var(--muted)', padding: 8 }}>그 닉네임의 회원이 없어요.</div>}
              {!searching && list.map(u => {
                const same = u.id === currentOwnerId
                return (
                  <button key={u.id} type="button" disabled={same} onClick={() => setPick(u)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 8px', border: 'none', borderBottom: '1px solid var(--border)', background: 'none', textAlign: 'left', cursor: same ? 'default' : 'pointer', opacity: same ? .45 : 1, color: 'var(--text)' }}>
                    {u.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={u.avatar_url} alt="" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 9999, objectFit: 'cover', flexShrink: 0 }} />
                      : <span style={{ width: 32, height: 32, borderRadius: 9999, background: 'var(--accent-l)', color: 'var(--accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>{(u.nickname ?? '?').slice(0, 1)}</span>}
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>{u.nickname ?? '(닉네임 없음)'}</span>
                    {same && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>지금 작성자</span>}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ background: 'var(--accent-l)', borderRadius: 12, padding: 14, fontSize: 14.5, lineHeight: 1.55 }}>
            <b>{pick.nickname}</b>님에게 이 루트를 넘길까요?
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>다시 되돌리려면 같은 방법으로 원래 작성자에게 넘기면 돼요.</div>
          </div>
        )}

        {err && <div role="alert" style={{ color: 'var(--red, #d33)', fontSize: 13, fontWeight: 700, marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={() => (pick ? setPick(null) : onClose())} disabled={busy}
            style={{ flex: 1, height: 44, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface, #fff)', color: 'var(--text)', fontWeight: 700, fontSize: 14.5, cursor: 'pointer' }}>
            {pick ? '다시 고르기' : '취소'}
          </button>
          {pick && (
            <button type="button" onClick={submit} disabled={busy}
              style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14.5, cursor: 'pointer' }}>
              {busy ? '넘기는 중…' : '넘기기'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
