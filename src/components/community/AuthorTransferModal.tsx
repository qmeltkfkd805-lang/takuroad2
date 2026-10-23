'use client'

import { useEffect, useState } from 'react'
import { UserAvatar } from '@/components/cosmetic/UserFace'
import { searchMembersByNickname, transferPostAuthor, type AuthorPick } from '@/services/postAuthorService'

/* 글 작성자 바꾸기 (타쿠로드 공식 계정만) — 닉네임으로 회원을 찾아 고르고, 한 번 더 확인한 뒤 바꾼다 */
export default function AuthorTransferModal({ postId, currentAuthor, onClose, onDone }: {
  postId: string
  currentAuthor: string | null
  onClose: () => void
  onDone: (a: AuthorPick) => void
}) {
  const [q, setQ] = useState('')
  const [list, setList] = useState<AuthorPick[]>([])
  const [loading, setLoading] = useState(false)
  const [pick, setPick] = useState<AuthorPick | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!q.trim()) { setList([]); return }
    let alive = true
    setLoading(true)
    const t = setTimeout(() => {
      searchMembersByNickname(q).then(r => { if (alive) { setList(r); setLoading(false) } })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  const submit = async () => {
    if (!pick || busy) return
    setBusy(true); setErr('')
    const r = await transferPostAuthor(postId, pick.id)
    setBusy(false)
    if (r === 'ok') { onDone(pick); onClose(); return }
    setErr(r === 'forbidden' ? '타쿠로드 계정만 작성자를 바꿀 수 있어요.' : '바꾸지 못했어요. 잠시 후 다시 시도해 주세요.')
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2200, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label="작성자 바꾸기" style={{ background: 'var(--surface)', borderRadius: 18, maxWidth: 400, width: '100%', padding: '22px 22px 20px' }}>
        <div style={{ fontSize: 17, fontWeight: 900, marginBottom: 4 }}>작성자 바꾸기</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>지금 작성자: <b style={{ color: 'var(--text)' }}>{currentAuthor ?? '익명'}</b></div>

        {!pick ? (
          <>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="새 작성자 닉네임 검색"
              style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit' }} />
            <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
              {loading && <div style={{ padding: '12px 4px', fontSize: 13, color: 'var(--muted)' }}>찾는 중…</div>}
              {!loading && q.trim() && list.length === 0 && <div style={{ padding: '12px 4px', fontSize: 13, color: 'var(--muted)' }}>그런 닉네임이 없어요.</div>}
              {list.map(m => (
                <button key={m.id} type="button" onClick={() => setPick(m)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 6px', border: 'none', borderRadius: 10, background: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', color: 'var(--text)', fontSize: 14, fontWeight: 700 }}>
                  <UserAvatar userId={m.id} src={m.avatarUrl} name={m.nickname} size={30} />
                  {m.nickname}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ padding: '14px', borderRadius: 12, background: 'var(--surface2)', fontSize: 14, lineHeight: 1.6 }}>
            이 글의 작성자를 <b style={{ color: 'var(--accent)' }}>{pick.nickname}</b>님으로 바꿀까요?
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>바꾸면 그 회원이 글을 고치고 지울 수 있고, 타쿠로드 계정의 글 목록에서는 빠져요.</div>
          </div>
        )}

        {err && <div style={{ fontSize: 13, color: '#c0392b', marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={pick ? () => { setPick(null); setErr('') } : onClose}
            style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>{pick ? '다시 고르기' : '취소'}</button>
          {pick && (
            <button type="button" onClick={submit} disabled={busy}
              style={{ flex: 1.4, padding: '12px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', opacity: busy ? .6 : 1 }}>{busy ? '바꾸는 중…' : '작성자 바꾸기'}</button>
          )}
        </div>
      </div>
    </div>
  )
}
