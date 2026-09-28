'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Story, StoryItem } from '@/services/storyBuilder'
import { AXIS_KEYS, AXIS_LABEL, AXIS_ICON, AXIS_VERB } from '@/lib/work/workProgress'
import { Icon, LineIcon } from '@/components/tds'
import { MaskIcon } from './MaskIcon'
import styles from './StoryCard.module.css'

/* ============================================================
   Story 카드 — 하나의 이야기

   ⭐ 이 컴포넌트는 계산하지 않는다.
      진행률·다음목표는 정책(lib/work/workProgress)이 계산해서 넘겨준 걸 그리기만 한다.
   ⭐ 이모지 금지. 아이콘은 public/icons 자산을 쓴다 (새로 그리지 않는다)

   ⭐⭐ 아이콘 색 규칙 — 아이콘은 "무엇인지" 알려주는 라벨이지 강조 장치가 아니다.
      · 라인 아이콘(샵·팝업·카페·전시·행사·루트·장소·축) = 전부 회색(--muted)
      · 핑크(--accent) = 값에만. 지역명·탐험도%·진행바·[다음 목표] 배지
      · 컬러 아이콘 = 섹션 표식 2개뿐. colorpin(지역=카드의 얼굴) / colorstar(이번 기록)
      핑크가 흩어지면 어디를 봐야 할지가 사라진다.
   ============================================================ */

/**
 * 아이콘·문구는 Activity Type이 아니라 snapshot을 보고 고른다.
 * 이벤트는 타입이 event_visit 하나뿐이고, 종류는 snapshot.event_type에 있다.
 * (그래서 새 이벤트 종류가 생겨도 Activity Type은 안 늘어난다)
 */
const EVENT_META: Record<string, { icon: string; label: string }> = {
  popup:          { icon: 'popup',      label: '참여' },
  collab_cafe:    { icon: 'cafe',       label: '방문' },
  exhibition:     { icon: 'exhibition', label: '관람' },
  official_event: { icon: 'event',      label: '참가' },
}

function itemMeta(item: StoryItem): { icon: string; label: string } {
  if (item.type === 'event_visit') {
    return EVENT_META[item.eventType ?? ''] ?? { icon: 'popup', label: '참여' }
  }
  if (item.type === 'route_completed') return { icon: 'route', label: '완주' }
  if (item.type === 'shop_visit') return { icon: 'shop', label: '방문' }
  return { icon: 'star', label: '' }
}

/**
 * 누르면 "지금 그 대상"으로 간다.
 * (snapshot은 그때의 이름을 보여주고, ref는 현재 페이지로 데려간다 — 둘 다 필요)
 */
function itemHref(item: StoryItem): string | null {
  // 이벤트 상세는 slug가 아니라 id로 열린다: /event/[id]
  if (item.refType === 'event' && item.refId) return `/event/${item.refId}`
  // 루트 상세는 id가 아니라 share_token으로 열린다: /route/[token]
  if (item.refType === 'route') return item.slug ? `/route/${item.slug}` : null
  if (item.slug) return `/shop/${item.slug}`
  return null
}

export default function StoryCard({ story }: { story: Story }) {
  const router = useRouter()
  const [y, m, d] = story.date.split('-')
  const hl = story.highlight
  // 사진 크게 보기 — 어느 항목의 몇 번째 사진인지
  const [viewer, setViewer] = useState<{ title: string; photos: string[]; index: number } | null>(null)

  return (
    <article className={styles.card}>
      <header className={styles.head}>
        <div className={styles.area}>
          <Icon name="colorpin" size={18} />
          <h3>{story.area}</h3>
        </div>
        <time className={styles.date}>{y}.{m}.{d}</time>
      </header>

      <div className={styles.body}>
        {story.places.map((place, i) => (
          <div key={i} className={styles.placeGroup}>
            {place.placeName && (
              <div className={styles.placeName}>
                <LineIcon name="pin" size={15} color="var(--accent)" />
                {place.placeName}
              </div>
            )}
            <ul className={place.placeName ? styles.itemsNested : styles.items}>
              {place.items.map(item => {
                const href = itemHref(item)
                const meta = itemMeta(item)
                return (
                  <li
                    key={item.id}
                    className={styles.item}
                    style={{ cursor: href ? 'pointer' : 'default' }}
                    onClick={() => href && router.push(href)}
                  >
                    <span className={styles.icon}>
                      <MaskIcon name={meta.icon} size={17} color="var(--muted)" />
                    </span>
                    <span className={styles.name}>{item.name}</span>
                    <span className={styles.label}>{meta.label}</span>
                    {/* 그 이벤트에서 남긴 내 사진(특전·음식 등) — 누르면 크게 */}
                    {item.photos && item.photos.length > 0 && (
                      <span className={styles.photos} onClick={e => e.stopPropagation()}>
                        {item.photos.map((src, pi) => (
                          <button key={pi} type="button" className={styles.photo} aria-label={`${item.name} 사진 ${pi + 1} 크게 보기`}
                            onClick={() => setViewer({ title: item.name, photos: item.photos!, index: pi })}>
                            <img src={src} alt="" loading="lazy" />
                          </button>
                        ))}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>

      {hl ? (
        <footer className={styles.highlight}>
          <div className={styles.hlLabel}>
            <Icon name="colorstar" size={14} />
            이번 기록
          </div>

          <div className={styles.hlMain}>
            <span className={styles.hlName}>{hl.name}</span>
            <span className={styles.hlPct}>탐험도 {hl.overall}%</span>
          </div>

          <div className={styles.bar}>
            <span style={{ width: `${hl.overall}%` }} />
          </div>

          {/* 축별 진행률 — 종합만 보여주면 "왜 62%인지"를 알 수 없다.
              그 작품에 아예 없는 축(total 0)은 줄 자체를 안 그린다 */}
          <ul className={styles.axes}>
            {AXIS_KEYS.filter(k => hl.axes[k].total > 0).map(k => {
              const a = hl.axes[k]
              return (
                <li key={k} className={styles.axis}>
                  <span className={styles.axisIcon}>
                    <MaskIcon name={AXIS_ICON[k]} size={16} color="var(--muted)" />
                  </span>
                  <span className={styles.axisLabel}>{AXIS_LABEL[k]}</span>
                  <span className={styles.axisBar}>
                    <span style={{ width: `${a.pct}%` }} />
                  </span>
                  <span className={styles.axisNum}>
                    {a.done} <em>/ {a.total}</em>
                  </span>
                </li>
              )
            })}
          </ul>

          {hl.next && (
            <div
              className={styles.next}
              onClick={() => hl.next?.href && router.push(hl.next.href)}
            >
              <span className={styles.nextLabel}>다음 목표</span>
              <span className={styles.nextText}>
                <b>{hl.next.name}</b>를 {AXIS_VERB[hl.next.axis]} 시 {hl.next.after}
              </span>
              <span className={styles.nextArrow}>›</span>
            </div>
          )}
        </footer>
      ) : (
        <footer className={styles.foot}>
          {story.area}에서 {story.totalCount}곳
        </footer>
      )}

      {viewer && (
        <PhotoViewer title={viewer.title} photos={viewer.photos} start={viewer.index} onClose={() => setViewer(null)} />
      )}
    </article>
  )
}

/* 사진 크게 보기 — 화면 위에 띄우고 ‹ › · ←/→ 키 · 좌우 스와이프로 넘긴다. Esc·바깥 클릭으로 닫기.
   카드 안에 두면 카드 레이아웃에 갇히므로 body 로 띄운다. */
function PhotoViewer({ title, photos, start, onClose }: { title: string; photos: string[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const touchX = useRef<number | null>(null)
  const total = photos.length
  const go = (d: number) => setI(v => Math.min(total - 1, Math.max(0, v + d)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') setI(v => Math.max(0, v - 1))
      else if (e.key === 'ArrowRight') setI(v => Math.min(total - 1, v + 1))
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'   // 뒤 화면 스크롤 잠금
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, total])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div className={styles.viewer} onClick={onClose} role="dialog" aria-modal="true" aria-label={`${title} 사진`}>
      <div className={styles.viewerTop} onClick={e => e.stopPropagation()}>
        <span className={styles.viewerTitle}>{title}</span>
        {total > 1 && <span className={styles.viewerCount}>{i + 1} / {total}</span>}
        <button type="button" className={styles.viewerClose} onClick={onClose} aria-label="닫기">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className={styles.viewerStage}
        onTouchStart={e => { touchX.current = e.touches[0].clientX }}
        onTouchEnd={e => {
          if (touchX.current == null) return
          const dx = e.changedTouches[0].clientX - touchX.current
          touchX.current = null
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}>
        <img src={photos[i]} alt="" className={styles.viewerImg} onClick={e => e.stopPropagation()} />
      </div>

      {i > 0 && (
        <button type="button" className={`${styles.viewerNav} ${styles.viewerPrev}`} aria-label="이전 사진" onClick={e => { e.stopPropagation(); go(-1) }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
      )}
      {i < total - 1 && (
        <button type="button" className={`${styles.viewerNav} ${styles.viewerNext}`} aria-label="다음 사진" onClick={e => { e.stopPropagation(); go(1) }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
      )}

      {total > 1 && (
        <div className={styles.viewerDots} onClick={e => e.stopPropagation()}>
          {photos.map((_, k) => (
            <button key={k} type="button" aria-label={`${k + 1}번째 사진`} onClick={() => setI(k)}
              className={k === i ? `${styles.viewerDot} ${styles.viewerDotOn}` : styles.viewerDot} />
          ))}
        </div>
      )}
    </div>,
    document.body,
  )
}
