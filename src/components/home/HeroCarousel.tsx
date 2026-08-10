'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { FeaturedBanner } from '@/services/featuredBannerService'
import styles from './HeroCarousel.module.css'

const AUTO_MS = 5000
const SWIPE_THRESHOLD = 50

export default function HeroCarousel({ banners }: { banners: FeaturedBanner[] }) {
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const dragX = useRef(0)
  const dragging = useRef(false)
  const [dragOffset, setDragOffset] = useState(0)

  const count = banners.length
  const multi = count > 1

  const go = useCallback((next: number) => { setIdx((next + count) % count) }, [count])

  useEffect(() => {
    if (!multi || paused) return
    const t = setTimeout(() => setIdx(i => (i + 1) % count), AUTO_MS)
    return () => clearTimeout(t)
  }, [idx, paused, multi, count])

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
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); onUp() }}
        onTouchStart={e => onDown(e.touches[0].clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onTouchEnd={onUp}
        onMouseDown={e => onDown(e.clientX)}
        onMouseMove={e => onMove(e.clientX)}
        onMouseUp={onUp}
      >
        <div
          className={styles.track}
          style={{
            transform: `translateX(calc(-${idx * 100}% + ${dragOffset}px))`,
            transition: dragging.current ? 'none' : 'transform .4s ease',
          }}
        >
          {banners.map(b => (<BannerSlide key={b.id} banner={b} />))}
        </div>
      </div>

      {multi && (
        <>
          <button className={styles.arrow + ' ' + styles.prev} onClick={() => go(idx - 1)} aria-label="이전">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <button className={styles.arrow + ' ' + styles.next} onClick={() => go(idx + 1)} aria-label="다음">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </button>
          <div className={styles.dots}>
            {banners.map((_, i) => (
              <button key={i} className={i === idx ? styles.dot + ' ' + styles.dotActive : styles.dot} onClick={() => go(i)} aria-label={`${i + 1}번째 배너`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function BannerSlide({ banner }: { banner: FeaturedBanner }) {
  const buttons = [
    { label: banner.cta_label, href: banner.cta_href },
    { label: banner.cta_label2, href: banner.cta_href2 },
  ].filter((b) => !!(b.label && b.label.trim()))
  const solo = buttons.length === 1

  return (
    <div className={styles.slide} style={{ background: banner.bg_color, color: banner.text_color }}>
      {banner.image_url && (
        <div className={styles.bgImage}>
          <img src={banner.image_url} alt="" draggable={false} />
          <div className={styles.scrim} />
        </div>
      )}
      <div className={styles.text}>
        {(banner as any).badge && <span className={styles.badge} style={{ color: banner.text_color }}>{(banner as any).badge}</span>}
        <h2 className={styles.title} style={{ color: banner.text_color }}>{banner.title}</h2>
        {banner.subtitle && <p className={styles.subtitle} style={{ color: banner.text_color }}>{banner.subtitle}</p>}
        {buttons.length > 0 && (
          <div className={styles.ctaRow}>
            {buttons.map((b, i) => (
              <Link
                key={i}
                href={b.href || '#'}
                className={(i === 0 ? styles.ctaPrimary : styles.ctaSecondary) + (solo ? ' ' + styles.ctaSolo : '')}
                draggable={false}
              >
                {b.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
