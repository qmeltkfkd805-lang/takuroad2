'use client'

import { useEffect, useRef, useState } from 'react'

/* 굿즈자랑 상세 사진 캐러셀 — CSS scroll-snap 기반(라이브러리 無).
   - PC: hover 화살표 · 키보드 · 드래그 · 하단 점 · 우하단 n/total · 클릭 라이트박스
   - 모바일: 스와이프(scroll-snap) · 점 · n/total · 화살표 숨김 · 탭 전체화면
   - object-fit: contain, 옅은 배경, 세로 긴 사진 최대높이 제한, 1장이면 컨트롤 숨김 */

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function useReducedMotion() {
  const [r, setR] = useState(false)
  useEffect(() => {
    try { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); setR(m.matches); const f = () => setR(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f) } catch { /* noop */ }
  }, [])
  return r
}

function Track({ images, alt, idx, setIdx, maxH, reduce }: {
  images: string[]; alt: string; idx: number; setIdx: (i: number) => void; maxH: string; reduce: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)

  const onScroll = () => {
    const el = ref.current; if (!el) return
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    if (i !== idx) setIdx(i)
  }
  useEffect(() => {
    const el = ref.current; if (!el) return
    const target = idx * el.clientWidth
    if (Math.abs(el.scrollLeft - target) > 2) el.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  // 데스크톱 마우스 드래그
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return
    const el = ref.current; if (!el) return
    drag.current = { x: e.clientX, left: el.scrollLeft, moved: false }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const el = ref.current; if (!el) return
    const dx = e.clientX - drag.current.x
    if (Math.abs(dx) > 4) drag.current.moved = true
    el.scrollLeft = drag.current.left - dx
  }
  const endDrag = () => {
    const el = ref.current
    if (el) { const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); setIdx(Math.min(images.length - 1, Math.max(0, i))) }
    drag.current = null
  }

  return (
    <div ref={ref} onScroll={onScroll}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerLeave={() => drag.current && endDrag()}
      className="pic-track"
      style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', width: '100%', height: '100%', scrollbarWidth: 'none' }}>
      {images.map((src, i) => (
        <div key={i} style={{ minWidth: '100%', height: '100%', scrollSnapAlign: 'center', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img src={src} alt={`${alt} 사진 ${i + 1}/${images.length}`} draggable={false}
            loading={i === 0 ? 'eager' : 'lazy'} {...(i === 0 ? { fetchpriority: 'high' } as any : {})}
            style={{ maxWidth: '100%', maxHeight: maxH, objectFit: 'contain', display: 'block', userSelect: 'none' }} />
        </div>
      ))}
    </div>
  )
}

export default function PostImageCarousel({ images, alt = '굿즈' }: { images: string[]; alt?: string }) {
  const [idx, setIdx] = useState(0)
  const [lightbox, setLightbox] = useState(false)
  const reduce = useReducedMotion()
  const single = images.length <= 1
  const clamp = (i: number) => Math.min(images.length - 1, Math.max(0, i))

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(false)
      else if (e.key === 'ArrowLeft') setIdx(i => clamp(i - 1))
      else if (e.key === 'ArrowRight') setIdx(i => clamp(i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, images.length])

  if (images.length === 0) return null

  return (
    <>
      <style>{`
        .pic-track::-webkit-scrollbar{display:none}
        .pic-wrap .pic-arrow{opacity:0;transition:opacity .15s}
        .pic-wrap:hover .pic-arrow{opacity:1}
        @media (hover:none) and (pointer:coarse){ .pic-arrow{display:none !important} }
        @media (prefers-reduced-motion: reduce){ .pic-track{scroll-behavior:auto} }
      `}</style>

      <div className="pic-wrap" tabIndex={0} role="group" aria-roledescription="캐러셀" aria-label={`${alt} 사진 ${images.length}장`}
        onKeyDown={e => { if (e.key === 'ArrowLeft') { e.preventDefault(); setIdx(i => clamp(i - 1)) } else if (e.key === 'ArrowRight') { e.preventDefault(); setIdx(i => clamp(i + 1)) } }}
        style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', maxHeight: '56vh', background: 'var(--surface2)', borderRadius: 14, overflow: 'hidden', outline: 'none' }}>
        <div style={{ position: 'absolute', inset: 0, cursor: 'zoom-in' }} onClick={() => setLightbox(true)}>
          <Track images={images} alt={alt} idx={idx} setIdx={setIdx} maxH="56vh" reduce={reduce} />
        </div>

        {!single && (
          <>
            <button className="pic-arrow" aria-label="이전 사진" onClick={() => setIdx(i => clamp(i - 1))} style={arrow('left')}>
              <svg width="20" height="20" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button className="pic-arrow" aria-label="다음 사진" onClick={() => setIdx(i => clamp(i + 1))} style={arrow('right')}>
              <svg width="20" height="20" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
            </button>
            <div aria-hidden style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
              {images.map((_, i) => (
                <button key={i} aria-label={`${i + 1}번째 사진으로`} onClick={() => setIdx(i)}
                  style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: 9999, border: 'none', padding: 0, cursor: 'pointer', background: i === idx ? '#fff' : 'rgba(255,255,255,.55)', transition: 'width .15s' }} />
              ))}
            </div>
            <div aria-live="polite" style={{ position: 'absolute', bottom: 8, right: 10, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 9999 }}>{idx + 1} / {images.length}</div>
          </>
        )}
      </div>

      {/* 라이트박스 */}
      {lightbox && (
        <div onClick={() => setLightbox(false)} style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(0,0,0,.92)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button aria-label="닫기" onClick={() => setLightbox(false)} style={{ position: 'fixed', top: 16, right: 16, zIndex: 4002, width: 40, height: 40, borderRadius: 9999, border: 'none', background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" {...P}><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
          <div className="pic-wrap" onClick={e => e.stopPropagation()} style={{ position: 'relative', width: '100%', height: '100%', maxWidth: 1100 }}>
            <Track images={images} alt={alt} idx={idx} setIdx={setIdx} maxH="90vh" reduce={reduce} />
            {!single && (
              <>
                <button className="pic-arrow" aria-label="이전 사진" onClick={() => setIdx(i => clamp(i - 1))} style={{ ...arrow('left'), opacity: 1 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>
                </button>
                <button className="pic-arrow" aria-label="다음 사진" onClick={() => setIdx(i => clamp(i + 1))} style={{ ...arrow('right'), opacity: 1 }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" {...P}><path d="m9 18 6-6-6-6" /></svg>
                </button>
                <div style={{ position: 'absolute', bottom: 16, right: 20, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 13, fontWeight: 700, padding: '3px 10px', borderRadius: 9999 }}>{idx + 1} / {images.length}</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function arrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: 10,
    width: 38, height: 38, borderRadius: 9999, border: 'none', background: 'rgba(0,0,0,.5)', color: '#fff',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
  } as React.CSSProperties
}
