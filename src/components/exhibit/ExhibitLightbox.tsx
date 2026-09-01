'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { getExhibitDetail, type ExhibitCard, type ExhibitDetail } from '@/services/exhibitService'

/* 전시 라이트박스 (데스크톱 전용)
   격자에서 사진을 누르면 그 전시 하나만 화면에 꽉 차게 띄운다.
   - 좌우 화살표(화면 가장자리) = 이전/다음 "전시"  ← ←/→ 키도 동일
   - 사진 위 작은 화살표·점 = 그 전시 안의 여러 장 넘기기
   - Esc 또는 배경 클릭으로 닫기
   ⚠️ 모바일에서는 절대 쓰지 말 것 — 호출부(useIsDesktop)에서 데스크톱일 때만 렌더한다. */

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const fmt = (s: string | null) => {
  if (!s) return ''
  const d = new Date(s)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

export default function ExhibitLightbox({ cards, index, ownerName, onIndex, onClose }: {
  cards: ExhibitCard[]
  index: number
  ownerName?: string | null
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const cache = useRef<Map<string, ExhibitDetail>>(new Map())
  const [detail, setDetail] = useState<ExhibitDetail | null>(null)
  const [imgIdx, setImgIdx] = useState(0)

  const card = cards[index]
  const hasPrev = index > 0
  const hasNext = index < cards.length - 1

  const go = useCallback((delta: number) => {
    const next = index + delta
    if (next < 0 || next >= cards.length) return
    onIndex(next)
  }, [index, cards.length, onIndex])

  // 전시 상세(서명 URL 포함) 로드 — 한 번 받은 건 캐시. 옆 전시는 미리 받아둬서 화살표가 즉시 넘어가게.
  useEffect(() => {
    if (!card) return
    setImgIdx(0)
    const cached = cache.current.get(card.id)
    setDetail(cached ?? null)
    let alive = true
    if (!cached) {
      getExhibitDetail(card.id).then(d => {
        if (d) cache.current.set(card.id, d)
        if (alive) setDetail(d)
      }).catch(() => { if (alive) setDetail(null) })
    }
    for (const n of [index - 1, index + 1]) {
      const c = cards[n]
      if (!c || cache.current.has(c.id)) continue
      getExhibitDetail(c.id).then(d => { if (d) cache.current.set(c.id, d) }).catch(() => {})
    }
    return () => { alive = false }
  }, [card, index, cards])

  // 키보드 — 좌우는 전시 이동, Esc는 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  // 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!card) return null

  // 상세가 아직이면 격자 커버를 먼저 보여줘 빈 화면이 안 생기게
  const images = detail?.images?.length ? detail.images : (card.coverUrl ? [card.coverUrl] : [])
  const shown = images[Math.min(imgIdx, Math.max(0, images.length - 1))] ?? null
  const workName = detail?.workName ?? card.workName
  const typeName = detail?.goodsTypeName ?? card.goodsTypeName
  const caption = detail?.caption ?? card.caption

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.93)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 84px' }}>
      <style>{`.exlb-nav{opacity:.75;transition:opacity .12s ease}.exlb-nav:hover{opacity:1}.exlb-imgnav{opacity:0;transition:opacity .12s ease}.exlb-stage:hover .exlb-imgnav{opacity:.9}`}</style>

      {/* 닫기 */}
      <button onClick={onClose} aria-label="닫기" className="exlb-nav"
        style={{ position: 'fixed', top: 18, right: 22, width: 40, height: 40, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" {...P}><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>

      {/* 전시 순번 */}
      <div style={{ position: 'fixed', top: 24, left: 26, color: 'rgba(255,255,255,.7)', fontSize: 13, fontWeight: 700 }}>
        {ownerName ? `${ownerName}님의 전시관 · ` : ''}{index + 1} / {cards.length}
      </div>

      {/* 이전 / 다음 전시 */}
      {hasPrev && (
        <button onClick={e => { e.stopPropagation(); go(-1) }} aria-label="이전 전시" className="exlb-nav"
          style={{ ...navBtn, left: 18 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}
      {hasNext && (
        <button onClick={e => { e.stopPropagation(); go(1) }} aria-label="다음 전시" className="exlb-nav"
          style={{ ...navBtn, right: 18 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      {/* 본체 — 사진 위, 정보 아래 */}
      {/* 카드 폭이 사진 비율을 따라간다 → 위아래·좌우 검은 여백(레터박스)이 안 생김 */}
      <div onClick={e => e.stopPropagation()}
        style={{ display: 'inline-flex', flexDirection: 'column', width: 'auto', maxWidth: 'min(980px, 100%)', minWidth: 380, maxHeight: '90vh', background: 'var(--surface)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 70px rgba(0,0,0,.5)' }}>

        {/* 사진 */}
        <div className="exlb-stage" style={{ position: 'relative', flex: '0 1 auto', minHeight: 0, background: '#0d0d0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {shown
            ? <img src={shown} alt={caption ?? '전시 사진'} style={{ display: 'block', width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: 'min(72vh, 780px)' }} />
            : <span style={{ padding: '80px 40px', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>사진을 불러오는 중…</span>}

          {images.length > 1 && (
            <>
              {imgIdx > 0 && (
                <button onClick={() => setImgIdx(i => i - 1)} aria-label="이전 사진" className="exlb-imgnav" style={{ ...imgNavBtn, left: 12 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
                </button>
              )}
              {imgIdx < images.length - 1 && (
                <button onClick={() => setImgIdx(i => i + 1)} aria-label="다음 사진" className="exlb-imgnav" style={{ ...imgNavBtn, right: 12 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
                </button>
              )}
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
                {images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} aria-label={`${i + 1}번째 사진`}
                    style={{ width: 7, height: 7, borderRadius: 9999, border: 'none', padding: 0, cursor: 'pointer', background: i === imgIdx ? '#fff' : 'rgba(255,255,255,.4)' }} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* 정보 — 사진 아래 */}
        <div style={{ flex: '0 0 auto', maxHeight: '18vh', overflowY: 'auto', padding: '16px 22px 18px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: caption ? 10 : 0 }}>
            {workName && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent, #ff5692)', padding: '3px 10px', borderRadius: 9999 }}>{workName}</span>}
            {typeName && <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{typeName}</span>}
            {detail?.goodsName && <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{detail.goodsName}</span>}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
              {detail?.postId && (
                <Link href={`/community/${detail.postId}`} style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)', textDecoration: 'none' }}>원본 글 보기 ›</Link>
              )}
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{fmt(detail?.createdAt ?? card.createdAt)}</span>
            </span>
          </div>
          {caption && (
            <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{caption}</p>
          )}
        </div>
      </div>
    </div>
  )
}

const navBtn: React.CSSProperties = {
  position: 'fixed', top: '50%', transform: 'translateY(-50%)', width: 48, height: 48, borderRadius: 9999,
  border: 'none', background: 'rgba(255,255,255,.12)', color: '#fff', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
const imgNavBtn: React.CSSProperties = {
  position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: 9999,
  border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}
