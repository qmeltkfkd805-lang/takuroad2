'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import {
  getUnlinkedEvents, getLinkedEvents, setEventShop,
  WORK_EVENT_LABEL, type LinkableEvent,
} from '@/services/eventService'

/* 이 샵에서 열리는 이벤트 연결
   샵보다 이벤트가 먼저 등록되면(그땐 카카오 장소로 넣음) events.shop_id가 비어서
   샵 상세에 안 뜬다. 주소·이름으로 후보를 찾아 붙여주는 도구.
   ⚠️ 완전 자동 연결은 하지 않는다 — 같은 건물(롯데월드몰 등)에 샵이 여러 개면
      주소만으로는 어느 샵의 이벤트인지 알 수 없어 엉뚱하게 붙는다.
      대신 "주소와 이름이 둘 다 맞는" 확실한 것만 한 번에 연결할 수 있게 한다. */

const norm = (s?: string | null) => (s ?? '').replace(/\s+/g, '').toLowerCase()
/** "서울 송파구 올림픽로 300" → "올림픽로300" (건물 단위 비교용) */
function roadKey(addr?: string | null): string {
  const m = (addr ?? '').match(/([가-힣A-Za-z0-9]+(?:대로|로|길))\s*(\d+(?:-\d+)?)/)
  return m ? norm(m[1] + m[2]) : ''
}
/** 지점명 꼬리를 떼서 비교 ("애니메이트 카페 잠실점" → "애니메이트카페잠실") */
const nameCore = (s?: string | null) => norm(s).replace(/점$/, '')
/** 두 글자 이상 겹치는 부분이 있는지 */
function overlaps(a: string, b: string): boolean {
  if (a.length < 2 || b.length < 2) return false
  for (let i = 0; i < a.length - 1; i++) if (b.includes(a.slice(i, i + 2))) return true
  return false
}

interface Scored { ev: LinkableEvent; score: number; strong: boolean; why: string }

export default function ShopEventLinkPanel({ shopId, shopName, shopAddr }: {
  shopId: string
  shopName: string
  shopAddr: string | null
}) {
  const { user } = useAuth()
  const [linked, setLinked] = useState<LinkableEvent[]>([])
  const [pool, setPool] = useState<LinkableEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    const [ls, ps] = await Promise.all([getLinkedEvents(shopId), getUnlinkedEvents()])
    setLinked(ls); setPool(ps); setLoading(false)
  }, [shopId])
  useEffect(() => { load() }, [load])

  // 후보 점수 — 주소(0·1·2) × 2 + 이름(0·1·2)
  const candidates = useMemo<Scored[]>(() => {
    const b = norm(shopAddr), rb = roadKey(shopAddr), sn = nameCore(shopName)
    const query = norm(q)
    const rows = pool.map(ev => {
      const a = norm(ev.placeAddr), ra = roadKey(ev.placeAddr), pn = nameCore(ev.placeName)
      const addrHit = a && b && (a === b || a.startsWith(b) || b.startsWith(a)) ? 2 : (ra && ra === rb ? 1 : 0)
      const nameHit = pn && sn && (pn.includes(sn) || sn.includes(pn)) ? 2 : (overlaps(pn, sn) ? 1 : 0)
      const strong = (addrHit === 2 && nameHit >= 1) || (nameHit === 2 && addrHit >= 1)
      const why = [addrHit === 2 ? '주소 일치' : addrHit === 1 ? '같은 건물' : '', nameHit ? '이름 비슷' : '']
        .filter(Boolean).join(' · ')
      return { ev, score: addrHit * 2 + nameHit, strong, why }
    })
    const matched = rows.filter(r => r.score > 0)
    if (query) {
      return rows
        .filter(r => norm(r.ev.title).includes(query) || norm(r.ev.placeName).includes(query) || norm(r.ev.placeAddr).includes(query))
        .sort((x, y) => y.score - x.score)
        .slice(0, 30)
    }
    return matched.sort((x, y) => y.score - x.score).slice(0, 30)
  }, [pool, shopAddr, shopName, q])

  const strongOnes = candidates.filter(c => c.strong && !q)

  async function link(ev: LinkableEvent) {
    if (!user || busy) return
    setBusy(ev.id)
    const ok = await setEventShop(ev.id, shopId, user.id)
    if (!ok) alert('연결에 실패했어요.')
    await load()
    setBusy(null)
  }
  async function unlink(ev: LinkableEvent) {
    if (!user || busy) return
    if (!confirm('이 이벤트의 샵 연결을 풀까요?\n이벤트 자체는 지워지지 않아요.')) return
    setBusy(ev.id)
    const ok = await setEventShop(ev.id, null, user.id)
    if (!ok) alert('연결 해제에 실패했어요.')
    await load()
    setBusy(null)
  }
  async function linkAllStrong() {
    if (!user || bulkBusy || strongOnes.length === 0) return
    if (!confirm(`주소와 이름이 모두 맞는 이벤트 ${strongOnes.length}개를 이 샵에 연결할까요?`)) return
    setBulkBusy(true)
    for (const c of strongOnes) await setEventShop(c.ev.id, shopId, user.id)
    await load()
    setBulkBusy(false)
  }

  const period = (ev: LinkableEvent) => [ev.startDate, ev.endDate].filter(Boolean).map(d => String(d).slice(2).replace(/-/g, '.')).join(' ~ ')

  if (loading) return <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>이벤트 확인 중…</div>

  return (
    <div>
      <h3 style={{ fontSize: 14, fontWeight: 900, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Svg size={15} color="var(--accent)"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>
        이 샵에서 열리는 이벤트
      </h3>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 12px', lineHeight: 1.6 }}>
        샵보다 먼저 등록된 이벤트는 장소만 저장돼 있어 이 샵과 이어지지 않아요. 아래에서 연결하면 샵 상세에 바로 나타납니다.
      </p>

      {/* 이미 연결된 것 */}
      {linked.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 7 }}>연결됨 {linked.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {linked.map(ev => (
              <div key={ev.id} style={row}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={rowTitle}>{ev.title || '(제목 없음)'}</div>
                  <div style={rowMeta}>{WORK_EVENT_LABEL[ev.type] ?? ev.type}{period(ev) && ` · ${period(ev)}`}</div>
                </div>
                <button onClick={() => unlink(ev)} disabled={busy === ev.id} style={btnGhost}>연결 해제</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 한 번에 연결 */}
      {strongOnes.length > 0 && (
        <button onClick={linkAllStrong} disabled={bulkBusy} style={{ ...btnPrimary, width: '100%', marginBottom: 12, opacity: bulkBusy ? .6 : 1 }}>
          {bulkBusy ? '연결 중…' : `주소·이름이 모두 맞는 ${strongOnes.length}개 한 번에 연결`}
        </button>
      )}

      {/* 검색 */}
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="이벤트 제목·장소로 직접 찾기"
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', marginBottom: 10, border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }}
      />

      {candidates.length === 0 ? (
        <p style={{ fontSize: 12.5, color: 'var(--muted)', padding: '14px 0', margin: 0 }}>
          {q ? '검색 결과가 없어요.' : '연결할 만한 이벤트를 찾지 못했어요. 위 검색창으로 직접 찾아보세요.'}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
          {candidates.map(({ ev, strong, why }) => (
            <div key={ev.id} style={row}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={rowTitle}>
                  {ev.title || '(제목 없음)'}
                  {strong && <span style={badge}>거의 확실</span>}
                </div>
                <div style={rowMeta}>
                  {WORK_EVENT_LABEL[ev.type] ?? ev.type}{period(ev) && ` · ${period(ev)}`}
                  {ev.placeName && ` · ${ev.placeName}`}
                </div>
                {(why || ev.placeAddr) && (
                  <div style={{ ...rowMeta, color: strong ? 'var(--accent)' : 'var(--muted)' }}>
                    {why || ev.placeAddr}
                  </div>
                )}
              </div>
              <button onClick={() => link(ev)} disabled={busy === ev.id} style={btnPrimary}>
                {busy === ev.id ? '연결 중…' : '연결'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)' }
const rowTitle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rowMeta: React.CSSProperties = { fontSize: 11.5, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const badge: React.CSSProperties = { flexShrink: 0, fontSize: 10, fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 5, padding: '1px 5px' }
const btnPrimary: React.CSSProperties = { flexShrink: 0, padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }
const btnGhost: React.CSSProperties = { flexShrink: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }

function Svg({ size = 14, color = 'currentColor', children }: { size?: number; color?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }} aria-hidden>{children}</svg>
}
