'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { floorGroupKey, floorGroupLabel } from '@/lib/route/autoOrder'
import s from './FloorMapViewer.module.css'

export type FloorMapSlide = {
  key: string; url: string; label: string
  /** 카드 모드: 사진 아래 이름·가격 */
  title?: string | null; sub?: string | null
}

/** 코스 순서대로 층 지도 목록 만들기 (같은 층 묶음은 한 번만) */
export function collectFloorMaps(shops: any[], floorMaps: Record<string, { url: string }>): FloorMapSlide[] {
  const out: FloorMapSlide[] = []
  const seen = new Set<string>()
  for (const shop of shops) {
    if (!shop) continue
    const key = floorGroupKey(shop)
    const fm = floorMaps[key]
    if (!fm?.url || seen.has(key)) continue
    seen.add(key)
    out.push({ key, url: fm.url, label: floorGroupLabel(shop) })
  }
  return out
}

/** 사진 모달 — 옆으로 밀거나 화살표로 넘기기 (층 지도, 이벤트 메뉴·굿즈 사진 등) */
export default function FloorMapViewer({ slides, startKey, onClose, name = '층 지도', card = false }: {
  slides: FloorMapSlide[]
  startKey: string
  onClose: () => void
  /** 무엇을 보는지 (화면 읽기용 이름) — 기본 '층 지도' */
  name?: string
  /** 카드 모드 — 사진 + 이름·가격이 한 장의 큰 카드로 넘어간다 (이벤트 메뉴·굿즈) */
  card?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const startIdx = Math.max(0, slides.findIndex(x => x.key === startKey))
  const [idx, setIdx] = useState(startIdx)

  const go = useCallback((n: number) => {
    const el = trackRef.current
    if (!el) return
    const next = Math.max(0, Math.min(slides.length - 1, n))
    el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' })
  }, [slides.length])

  // 처음 연 지도 위치로 바로 이동
  useEffect(() => {
    const el = trackRef.current
    if (el) el.scrollLeft = startIdx * el.clientWidth
  }, [startIdx])

  // 뒤 화면 스크롤 막기 + 키보드 (← → Esc)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(idx + 1)
      else if (e.key === 'ArrowLeft') go(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [idx, go, onClose])

  function onScroll() {
    const el = trackRef.current
    if (!el || !el.clientWidth) return
    const n = Math.round(el.scrollLeft / el.clientWidth)
    if (n !== idx) setIdx(n)
  }

  const cur = slides[idx]
  const many = slides.length > 1
  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" aria-label={name} onClick={onClose}>
      <div className={s.head} onClick={e => e.stopPropagation()}>
        <span className={s.title}>{card ? name : (cur?.label ?? name)}</span>
        {many && <span className={s.count}>{idx + 1} / {slides.length}</span>}
        <button type="button" className={s.close} onClick={onClose} aria-label="닫기">✕</button>
      </div>

      <div className={s.track} ref={trackRef} onScroll={onScroll}>
        {slides.map(sl => (
          <div key={sl.key} className={s.slide}>
            {card ? (
              <div className={s.card} onClick={e => e.stopPropagation()}>
                <div className={s.cardImg}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sl.url} alt={sl.label} draggable={false} />
                </div>
                {(sl.title || sl.sub) && (
                  <div className={s.cardBody}>
                    {sl.title && <div className={s.cardTitle}>{sl.title}</div>}
                    {sl.sub && <div className={s.cardSub}>{sl.sub}</div>}
                  </div>
                )}
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={sl.url} alt={name === '층 지도' ? `${sl.label} 층 지도` : sl.label} onClick={e => e.stopPropagation()} draggable={false} />
            )}
          </div>
        ))}
      </div>

      {many && (
        <>
          <button type="button" className={`${s.arrow} ${s.left}`} disabled={idx === 0} onClick={e => { e.stopPropagation(); go(idx - 1) }} aria-label={`이전 ${name}`}>‹</button>
          <button type="button" className={`${s.arrow} ${s.right}`} disabled={idx === slides.length - 1} onClick={e => { e.stopPropagation(); go(idx + 1) }} aria-label={`다음 ${name}`}>›</button>
          {slides.length <= 12 && (   /* 사진이 많으면 점 대신 위의 '3 / 20' 숫자로 */
          <div className={s.dots} onClick={e => e.stopPropagation()}>
            {slides.map((sl, i) => (
              <button key={sl.key} type="button" className={`${s.dot} ${i === idx ? s.dotOn : ''}`} onClick={() => go(i)} aria-label={sl.label} />
            ))}
          </div>
          )}
        </>
      )}
    </div>
  )
}
