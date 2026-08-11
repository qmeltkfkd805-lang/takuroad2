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
  const [stopped, setStopped] = useState(false)    // 사용자가 일시정지 버튼으로 끔
  const dragX = useRef(0)
  const dragging = useRef(false)
  const [dragOffset, setDragOffset] = useState(0)

  const count = slots.length
  const multi = count > 1
  const frozen = paused || stopped

  const go = useCallback((next: number) => { setIdx((next + count) % count) }, [count])

  useEffect(() => {
    if (!multi || frozen) return
    const t = setTimeout(() => setIdx(i => (i + 1) % count), AUTO_MS)
    return () => clearTimeout(t)
  }, [idx, frozen, multi, count])

  // 슬롯 수가 줄면 인덱스 보정
  useEffect(() => { if (idx >= count) setIdx(0) }, [count, idx])

  if (count === 0) return null

  function onDown(clientX: number) { dragging.current = true; dragX.current = clientX; setPaused(true) }
  function onMove(clientX: number) { if (!dragging.current) return; setDragOffset(clientX - dragX.current) }
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
          {slots.map(s => (<HeroSlide key={s.id} card={s} />))}
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

          {/* 하단 바: 분류 라벨 · dots · (일시정지) · i/N 카운터 */}
          <div className={styles.bottomBar}>
            <span />{/* 좌측 여백 유지용 — 하단 분류 라벨 제거 */}
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
            <div className={styles.bottomRight}>
              <button
                className={styles.playBtn}
                onClick={() => setStopped(s => !s)}
                aria-label={stopped ? '자동 넘김 재생' : '자동 넘김 정지'}
              >
                {stopped ? (
                  <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24"><path d="M7 5h3v14H7zM14 5h3v14h-3z" /></svg>
                )}
              </button>
              <span className={styles.counter}>{idx + 1} / {count}</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function HeroSlide({ card }: { card: HeroCard }) {
  const hasImage = !!card.imageUrl
  const slideClass = styles.slide + ' ' + (hasImage ? styles.slideImage : styles[`tint_${card.category}`])

  return (
    <div className={slideClass}>
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
        <div className={styles.ctaRow}>
          <Link href={card.ctaHref || '#'} className={styles.ctaPrimary + ' ' + styles.ctaSolo} draggable={false}>
            {card.ctaText || '자세히 보기'}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
        </div>
      </div>
    </div>
  )
}
