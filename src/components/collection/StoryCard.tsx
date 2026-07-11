'use client'

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
    </article>
  )
}
