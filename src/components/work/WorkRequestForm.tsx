'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/layout/AuthProvider'
import { findDuplicateWork } from '@/services/workRegisterService'
import { createWorkRequest, getMyWorkRequests, workRequestStatusLabel, WorkRequest } from '@/services/workRequestService'

const inp: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  border: '1px solid var(--border)', background: 'var(--surface2)',
  fontSize: 14, fontFamily: 'inherit', color: 'var(--text)',
  marginBottom: 14, boxSizing: 'border-box',
}

function Label({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px' }}>
      {children}{req && <span style={{ color: 'var(--accent)' }}> *</span>}
    </div>
  )
}

export default function WorkRequestForm() {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [eng, setEng] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [dup, setDup] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [mine, setMine] = useState<WorkRequest[]>([])
  const [reload, setReload] = useState(0)

  // 요청의 목적이 중복을 줄이는 것이라, 입력 중에 이미 있는 작품인지 알려준다
  useEffect(() => {
    let alive = true
    const t = setTimeout(() => {
      const s = name.trim()
      if (s.length < 2) { if (alive) setDup(null); return }
      findDuplicateWork(s, eng.trim(), [])
        .then(d => { if (alive) setDup(d) })
        .catch(() => { if (alive) setDup(null) })
    }, 400)
    return () => { alive = false; clearTimeout(t) }
  }, [name, eng])

  useEffect(() => {
    if (!user) return
    let alive = true
    getMyWorkRequests(user.id).then(r => { if (alive) setMine(r) }).catch(() => {})
    return () => { alive = false }
  }, [user, reload])

  async function submit() {
    if (!user) { setMsg('로그인이 필요해요.'); return }
    if (!name.trim()) { setMsg('작품명을 입력해주세요.'); return }
    if (dup) { setMsg('이미 등록된 작품이에요: ' + dup); return }
    setSaving(true); setMsg(null)
    const res = await createWorkRequest(user.id, { name, englishName: eng, refUrl: url, note })
    setSaving(false)
    if (!res.ok) { setMsg(res.error ?? '요청 등록에 실패했어요.'); return }
    setName(''); setEng(''); setUrl(''); setNote('')
    setDone(true); setReload(n => n + 1)
  }

  if (!user) {
    return (
      <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
        작품 추가 요청은 로그인 후에 남길 수 있어요. <Link href="/login" style={{ color: 'var(--accent)', fontWeight: 800 }}>로그인하기</Link>
      </p>
    )
  }

  return (
    <>
      <Label req>작품명</Label>
      <input value={name} onChange={e => { setName(e.target.value); setDone(false) }} maxLength={100}
        placeholder="예: 체인소 맨" style={inp} />

      {dup && (
        <div style={{ margin: '-6px 0 14px', padding: '10px 12px', borderRadius: 10, background: 'var(--surface2)', border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6 }}>
          이미 등록된 작품이에요 — <b>{dup}</b><br />
          <span style={{ color: 'var(--muted)' }}>검색에서 찾아보세요. 다른 작품이라면 아래 &lsquo;하고 싶은 말&rsquo;에 구분되는 점을 적어주세요.</span>
        </div>
      )}

      <Label>작품명 (영문)</Label>
      <input value={eng} onChange={e => setEng(e.target.value)} maxLength={100}
        placeholder="예: Chainsaw Man (선택)" style={inp} />

      <Label>참고 링크</Label>
      <input value={url} onChange={e => setUrl(e.target.value)} maxLength={300}
        placeholder="공식 사이트·위키 등 (선택)" style={inp} />

      <Label>하고 싶은 말</Label>
      <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={300}
        placeholder="어떤 작품인지 간단히 알려주세요 (선택)"
        style={{ ...inp, minHeight: 84, resize: 'vertical' }} />

      {msg && <p style={{ fontSize: 13, color: 'var(--accent)', margin: '0 0 12px', fontWeight: 700 }}>{msg}</p>}
      {done && <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>요청을 남겼어요. 확인 후 등록해 드릴게요.</p>}

      <button onClick={submit} disabled={saving || !name.trim() || !!dup}
        style={{
          width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
          background: saving || !name.trim() || dup ? 'var(--border)' : 'var(--accent)',
          color: '#fff', fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
          cursor: saving || !name.trim() || dup ? 'default' : 'pointer',
        }}>
        {saving ? '보내는 중...' : '요청 보내기'}
      </button>

      {mine.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>내 요청 {mine.length}건</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {mine.map(r => (
              <div key={r.id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <b style={{ fontSize: 14 }}>{r.name}</b>
                  <span style={{ fontSize: 12, fontWeight: 800, color: r.status === 'approved' ? 'var(--accent)' : 'var(--muted)' }}>
                    {workRequestStatusLabel(r.status)}
                  </span>
                </div>
                {r.admin_note && (
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', margin: '8px 0 0', lineHeight: 1.6 }}>{r.admin_note}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
