'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoodsPageShell from './GoodsPageShell'
import { getGoodsDetail, type GoodsDetail } from '@/services/goodsService'

/* 읽기 전용 굿즈 상세 — 연결된 굿즈자랑 글이 삭제됐거나 직접 등록한 굿즈를 "올라갔을 때처럼" 보여줌.
   사진은 인라인 세로 나열, 아래 흰색 굿즈 정보 카드. 소장 정보(구입처·가격·구매일·메모)는 소유자에게만 RPC가 반환. */

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`
}

export default function GoodsDetailView({ id }: { id: string }) {
  const router = useRouter()
  const [g, setG] = useState<GoodsDetail | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    setState('loading')
    getGoodsDetail(id)
      .then(d => { if (!alive) return; if (d) { setG(d); setState('ok') } else setState('error') })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [id])

  const editBtn = (
    <button onClick={() => router.push(`/profile/goods/${id}/edit`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 36, padding: '0 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 800, cursor: 'pointer' }}>
      <svg width="15" height="15" viewBox="0 0 24 24" {...P}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      수정
    </button>
  )

  const chars = (g?.characterName ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const types = Array.isArray(g?.tags) ? g!.tags.filter(Boolean) : []
  const metas: string[] = []
  if (g?.store) metas.push(g.store)
  if (g?.purchasedOn) metas.push(`${fmtDate(g.purchasedOn)} 구매`)
  if (g?.price != null) metas.push(`가격 ${g.price.toLocaleString('ko-KR')}원`)
  const hasInfo = chars.length > 0 || types.length > 0 || metas.length > 0 || !!g?.memo
  const pill = (accent: boolean): React.CSSProperties => ({
    fontSize: 11.5, fontWeight: 700, padding: '2px 9px', borderRadius: 9999, lineHeight: 1.5,
    color: accent ? 'var(--accent)' : 'var(--text)',
    background: accent ? 'var(--accent-l, rgba(232,0,111,.08))' : 'var(--surface2)',
    border: `1px solid ${accent ? 'var(--accent, #ff5692)' : 'var(--border)'}`,
  })

  return (
    <GoodsPageShell
      crumbs={[{ label: '마이', href: '/profile' }, { label: '내 굿즈', href: '/profile/goods' }, { label: '굿즈' }]}
      title="굿즈"
      right={state === 'ok' ? editBtn : undefined}
    >
      {state === 'loading' && (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>
      )}
      {state === 'error' && (
        <div style={{ padding: 48, textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>굿즈를 찾을 수 없어요.</p>
          <button onClick={() => router.push('/profile/goods')} style={{ padding: '10px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>내 굿즈로</button>
        </div>
      )}
      {state === 'ok' && g && (
        <div style={{ maxWidth: 680 }}>
          {/* 상단: 작품/등록일 + 수정 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {g.workName && (
              <button onClick={() => g.workSlug ? router.push(`/work/${encodeURIComponent(g.workSlug)}`) : (g.workId && router.push(`/work/${g.workId}`))} style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', background: 'var(--accent-l, rgba(232,0,111,.08))', border: 'none', padding: '4px 11px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit' }}>
                {g.workName} ›
              </button>
            )}
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fmtDate(g.createdAt)} 기록</span>
            <span style={{ marginLeft: 'auto' }} className="gv-edit-desktop">{editBtn}</span>
          </div>

          {/* 제목 */}
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', margin: '0 0 16px' }}>{g.name || g.goodsTypeName || '이름 없는 굿즈'}</h1>

          {/* 사진 (세로 나열) */}
          {g.images.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 18 }}>
              {g.images.map((im, i) => im.url ? (
                <img key={im.id ?? i} src={im.url} alt={`${g.name ?? '굿즈'} 사진 ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'}
                  style={{ width: '100%', borderRadius: 14, display: 'block', background: 'var(--surface2)' }} />
              ) : null)}
            </div>
          )}

          {/* 굿즈 정보 카드 (커뮤니티 글에서 보이던 가로형) */}
          {hasInfo && (
            <div style={{ border: '1px solid var(--border)', borderRadius: 14, background: 'var(--surface)', padding: '12px 14px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: 'var(--accent)', marginBottom: 10 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" {...P}><path d="M20 7h-3.6a2.4 2.4 0 1 0-4.4 0M8 7H4.4M4 7h16v13H4zM12 7v13M4 12h16" /></svg>
                굿즈 정보
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
                <span style={{ width: 60, height: 60, borderRadius: 11, overflow: 'hidden', flexShrink: 0, background: 'var(--surface2)', position: 'relative', display: 'block' }}>
                  {g.images[0]?.url
                    ? <img src={g.images[0].url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)' }}><svg width="22" height="22" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
                </span>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: (chars.length || types.length || metas.length) ? 6 : 0 }}>{g.name || g.goodsTypeName || '이름 없는 굿즈'}</div>
                  {(chars.length > 0 || types.length > 0 || metas.length > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                      {chars.map((c, i) => <span key={'c' + i} style={pill(true)}>{c}</span>)}
                      {types.map((t, i) => <span key={'t' + i} style={pill(false)}>{t}</span>)}
                      {metas.length > 0 && <span style={{ color: 'var(--muted)' }}>{(chars.length > 0 || types.length > 0) ? '· ' : ''}{metas.join(' · ')}</span>}
                    </div>
                  )}
                </div>
              </div>
              {g.memo && <div style={{ marginTop: 11, paddingTop: 11, borderTop: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{g.memo}</div>}
            </div>
          )}
        </div>
      )}
      {/* 데스크톱에서만 상단 수정 버튼 노출(모바일은 셸 헤더의 수정 사용) */}
      <style>{`@media (max-width:768px){ .gv-edit-desktop{ display:none } }`}</style>
    </GoodsPageShell>
  )
}
