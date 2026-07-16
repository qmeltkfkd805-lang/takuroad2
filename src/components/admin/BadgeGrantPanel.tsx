'use client'

import { useState, useEffect, type CSSProperties } from 'react'
import { createClient } from '@/lib/supabase/client'

type ManualBadge = { id: string; name: string; icon_url: string | null; badgeName: string }
type UserHit = { id: string; nickname: string; avatar_url: string | null }

// 관리자 대시보드용 — 유저 검색 후 수동 배지(창립멤버·베타테스터·한정판)를 지급.
export default function BadgeGrantPanel() {
  const [badges, setBadges] = useState<ManualBadge[]>([])
  const [tierId, setTierId] = useState('')
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<UserHit[]>([])
  const [picked, setPicked] = useState<UserHit | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    ;(async () => {
      const { data } = await sb
        .from('badge_tiers')
        .select('id, name, icon_url, badges(name)')
        .eq('award_type', 'manual')
        .eq('is_active', true)
      const list: ManualBadge[] = (data ?? []).map((t: any) => ({
        id: t.id, name: t.name, icon_url: t.icon_url, badgeName: t.badges?.name ?? '',
      }))
      setBadges(list)
      if (list.length > 0) setTierId(list[0].id)
    })()
  }, [])

  async function search() {
    if (q.trim().length < 1) return
    const sb = createClient()
    const { data } = await sb
      .from('profiles')
      .select('id, nickname, avatar_url')
      .ilike('nickname', '%' + q.trim() + '%')
      .limit(10)
    setHits((data ?? []) as UserHit[])
  }

  async function grant() {
    if (!picked || !tierId) return
    setBusy(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/grant-badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: picked.id, tierId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult('실패: ' + (data.error ?? res.status))
      } else {
        const bname = badges.find(b => b.id === tierId)?.name ?? '배지'
        setResult('지급 완료 — ' + picked.nickname + ' 님에게 "' + bname + '"')
      }
    } catch (e: any) {
      setResult('오류: ' + (e?.message ?? '알 수 없음'))
    } finally {
      setBusy(false)
    }
  }

  const box: CSSProperties = {
    margin: '4px 0 24px', padding: 14,
    border: '1px solid var(--border)', borderRadius: 12,
  }
  const input: CSSProperties = {
    flex: 1, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit',
    border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg)', color: 'var(--text)',
  }
  const btn = (on: boolean): CSSProperties => ({
    padding: '8px 14px', fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
    borderRadius: 8, border: 'none', color: '#fff',
    cursor: on ? 'pointer' : 'default', background: on ? 'var(--accent)' : 'var(--muted)',
  })

  return (
    <div style={box}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>배지 수동 지급</div>
      <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
        창립멤버·베타테스터·한정판 등 운영자가 직접 주는 배지. 유저를 찾아 지급합니다.
      </div>

      {badges.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
          수동 지급 배지가 아직 없습니다. (award_type = manual 배지를 먼저 생성하세요)
        </div>
      ) : (
        <>
          <div style={{ marginBottom: 10 }}>
            <select value={tierId} onChange={e => setTierId(e.target.value)} style={{ ...input, width: '100%' }}>
              {badges.map(b => (
                <option key={b.id} value={b.id}>{b.name}{b.badgeName ? ' (' + b.badgeName + ')' : ''}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input
              style={input}
              placeholder="닉네임으로 유저 검색"
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') search() }}
            />
            <button onClick={search} style={btn(q.trim().length > 0)}>검색</button>
          </div>

          {hits.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
              {hits.map(u => (
                <button
                  key={u.id}
                  onClick={() => setPicked(u)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                    borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                    border: '1px solid ' + (picked?.id === u.id ? 'var(--accent)' : 'var(--border)'),
                    background: picked?.id === u.id ? 'rgba(255,86,146,.08)' : 'transparent',
                  }}
                >
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                    : <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--border)', display: 'inline-block' }} />}
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>{u.nickname}</span>
                </button>
              ))}
            </div>
          )}

          <button onClick={grant} disabled={!picked || busy} style={{ ...btn(!!picked && !busy), width: '100%' }}>
            {busy ? '지급 중...' : picked ? picked.nickname + ' 님에게 지급' : '유저를 선택하세요'}
          </button>
        </>
      )}

      {result && <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text)' }}>{result}</div>}
    </div>
  )
}