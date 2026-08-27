'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { HeroCard } from '@/lib/home/heroTypes'
import styles from './HeroCarousel.module.css'

const AUTO_MS = 5000
const SWIPE_THRESHOLD = 50

export default function HeroCarousel({ slots }: { slots: HeroCard[] }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)      // hover/포커스/드래그 등 일시 정지
  const dragX = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(false)        // 드래그/스와이프 발생 시 클릭 네비 억제
  const [dragOffset, setDragOffset] = useState(0)

  const count = slots.length
  const multi = count > 1
  const frozen = paused

  const go = useCallback((next: number) => { setIdx((next + count) % count) }, [count])

  useEffect(() => {
    if (!multi || frozen) return
    const t = setTimeout(() => setIdx(i => (i + 1) % count), AUTO_MS)
    return () => clearTimeout(t)
  }, [idx, frozen, multi, count])

  // 슬롯 수가 줄면 인덱스 보정
  useEffect(() => { if (idx >= count) setIdx(0) }, [count, idx])

  if (count === 0) return null

  function onDown(clientX: number) { dragging.current = true; moved.current = false; dragX.current = clientX; setPaused(true) }
  function onMove(clientX: number) { if (!dragging.current) return; const d = clientX - dragX.current; if (Math.abs(d) > 6) moved.current = true; setDragOffset(d) }
  function onUp() {
    if (!dragging.current) return
    dragging.current = false
    const dx = dragOffset
    setDragOffset(0)
    setPaused(false)
    if (multi && Math.abs(dx) > SWIPE_THRESHOLD) go(dx < 0 ? idx + 1 : idx - 1)
  }


  return (
    <div className={styles.wrap}>
      <div
        className={styles.viewport}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="홈 추천"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); onUp() }}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onTouchStart={e => onDown(e.touches[0].clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onTouchEnd={onUp}
        onMouseDown={e => onDown(e.clientX)}
        onMouseMove={e => onMove(e.clientX)}
        onMouseUp={onUp}
        onKeyDown={e => {
          if (!multi) return
          if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1) }
          if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1) }
        }}
      >
        <div
          className={styles.track}
          style={{
            transform: `translateX(calc(-${idx * 100}% + ${dragOffset}px))`,
            transition: dragging.current ? 'none' : 'transform .4s ease',
          }}
        >
          {slots.map(s => (<HeroSlide key={s.id} card={s} guard={moved} />))}
        </div>
      </div>

      {multi && (
        <>
          <button className={styles.arrow + ' ' + styles.prev} onClick={() => go(idx - 1)} aria-label="이전">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button className={styles.arrow + ' ' + styles.next} onClick={() => go(idx + 1)} aria-label="다음">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
          </button>

          {/* 하단 바: dots */}
          <div className={styles.bottomBar}>
            <div className={styles.dots}>
              {slots.map((_, i) => (
                <button
                  key={i}
                  className={i === idx ? styles.dot + ' ' + styles.dotActive : styles.dot}
                  onClick={() => go(i)}
                  aria-label={`${i + 1}번째로 이동`}
                  aria-current={i === idx}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HeroSlide({ card, guard }: { card: HeroCard; guard: React.MutableRefObject<boolean> }) {
  const hasImage = !!card.imageUrl
  const slideClass = styles.slide + ' ' + (hasImage ? styles.slideImage : styles[`tint_${card.category}`])

  return (
    <div className={slideClass} style={{ position: 'relative' }}>
      {hasImage && (
        <div className={styles.bgImage}>
          <img src={card.imageUrl!} alt="" draggable={false} />
          <div className={styles.scrim} />
        </div>
      )}
      <div className={styles.text}>
        <div className={styles.badgeRow}>
          {card.label && <span className={styles.label}>{card.label}</span>}
          {card.badge && <span className={styles.startChip}>{card.badge}</span>}
        </div>
        <h2 className={styles.title}>{card.headline}</h2>
        {card.meta && <p className={styles.meta}>{card.meta}</p>}
        {card.description && <p className={styles.subtitle}>{card.description}</p>}
      </div>
      {/* 카드 전체 클릭 → 이동 (드래그/스와이프 시엔 이동 억제) */}
      <Link
        href={card.ctaHref || '#'}
        aria-label={card.headline}
        draggable={false}
        onClick={e => { if (guard.current) e.preventDefault() }}
        style={{ position: 'absolute', inset: 0, zIndex: 3 }}
      />
    </div>
  )
}
