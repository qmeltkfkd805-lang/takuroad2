'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { EventCard, SectionHeader } from '@/components/tds'
import { getEventStatus } from '@/lib/utils/eventStatus'
import { rankEvents, toEventHomeSections, pickHeroEvent, daysUntil, RankedEvent } from '@/lib/event/rankEvents'
import {
  EventHomeItem, getEventHomeItems, getPastEventItems, getMyAffinityTagIds,
} from '@/services/eventHomeService'
import EventFilterBar, { EventFilters, EMPTY_FILTERS } from './EventFilterBar'
import EventHomeRail from './EventHomeRail'
import EventCalendarWidget from './EventCalendarWidget'
import { EventIcon, EventIconName } from './EventIcon'
import styles from './EventHomePage.module.css'

const fmt = (s: string | null) =>
  s ? `${new Date(s).getMonth() + 1}.${String(new Date(s).getDate()).padStart(2, '0')}` : ''

const isThisWeek = (startDate: string | null) => {
  if (!startDate) return false
  const d = daysUntil(startDate)
  return d >= 0 && d <= 7
}

export default function EventHomePage() {
  const router = useRouter()
  const { user } = useAuth()

  const [items, setItems] = useState<EventHomeItem[]>([])
  const [favoriteTagIds, setFavoriteTagIds] = useState<Set<string>>(new Set())
  const [interestTagIds, setInterestTagIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<EventFilters>(EMPTY_FILTERS)

  const [past, setPast] = useState<EventHomeItem[] | null>(null)
  const [pastLoading, setPastLoading] = useState(false)

  useEffect(() => {
    getEventHomeItems().then(setItems).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) { setFavoriteTagIds(new Set()); return }
    getMyAffinityTagIds(user.id)
      .then(({ favorites, interests }) => {
        setFavoriteTagIds(new Set(favorites))
        setInterestTagIds(new Set(interests))
      })
      .catch(() => {})
  }, [user])

  const openEvent = useCallback((ev: EventHomeItem) => {
    router.push(`/event/${ev.id}`)
  }, [router])

  // Hero와 통계는 필터를 타지 않는다 — "지금 이 서비스에 뭐가 있나"를 보여주는 자리
  const allRanked = useMemo(() => rankEvents(items, { favoriteTagIds }), [items, favoriteTagIds])
  const hero = pickHeroEvent(allRanked)
  const allSections = useMemo(() => toEventHomeSections(allRanked), [allRanked])
  const stats = {
    ongoing: allSections.ongoing.length,
    endsToday: allSections.endsToday.length,
    thisWeek: items.filter(i => isThisWeek(i.startDate)).length,
  }

  const filtered = useMemo(() => items.filter(i => {
    if (filters.region && i.region !== filters.region) return false
    if (filters.tagId && i.tagId !== filters.tagId) return false
    if (filters.type && i.type !== filters.type) return false
    if (filters.favoriteOnly && !(i.tagId && favoriteTagIds.has(i.tagId))) return false
    if (filters.statuses.length > 0) {
      const kind = getEventStatus(i).kind
      const ok = filters.statuses.some(s =>
        s === 'ends_today' ? kind === 'ends_today'
          : s === 'ongoing' ? (kind === 'ongoing' || kind === 'ending_soon' || kind === 'starts_today')
            : isThisWeek(i.startDate))
      if (!ok) return false
    }
    return true
  }), [items, filters, favoriteTagIds])

  const sections = useMemo(
    () => toEventHomeSections(rankEvents(filtered, { favoriteTagIds })),
    [filtered, favoriteTagIds],
  )

  const regions = useMemo(
    () => [...new Set(items.map(i => i.region).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'ko')),
    [items],
  )
  const works = useMemo(() => {
    const map = new Map<string, string>()
    for (const i of items) if (i.tagId && i.workName) map.set(i.tagId, i.workName)
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [items])

  const loadPast = async () => {
    setPastLoading(true)
    const rows = await getPastEventItems(12)
    setPast(rows)
    setPastLoading(false)
  }

  const affinityOf = (tagId: string | null): 'favorite' | 'interest' | null =>
    tagId && favoriteTagIds.has(tagId) ? 'favorite'
    : tagId && interestTagIds.has(tagId) ? 'interest'
    : null

  const toCard = (ev: EventHomeItem) => ({
    id: ev.id, title: ev.title, type: ev.type,
    workName: ev.workName, place: ev.placeName ?? ev.shopName,
    startDate: ev.startDate, endDate: ev.endDate, coverUrl: ev.coverUrl,
    affinity: affinityOf(ev.tagId),
  })

  if (loading) {
    return <div className={styles.layout}><div className={styles.main}><div className={styles.skeleton} /></div></div>
  }

  return (
    <div className={styles.layout}>
      <div className={styles.main}>

        {/* Hero + 이번 주 통계 */}
        <div className={styles.heroRow}>
          <div className={styles.hero}>
            {hero ? (
              <>
                <div className={styles.heroLabel}>이번 주 가장 핫한 이벤트</div>
                <h1 className={styles.heroTitle}>{hero.event.title}</h1>
                <p className={styles.heroSub}>
                  {[hero.event.workName, hero.event.shopName].filter(Boolean).join(' · ')}
                  {hero.event.startDate && ` · ${fmt(hero.event.startDate)} ~ ${fmt(hero.event.endDate)}`}
                </p>
                <button className={styles.heroCta} onClick={() => openEvent(hero.event)}>지금 보러가기</button>
              </>
            ) : (
              <>
                <div className={styles.heroLabel}>이벤트</div>
                <h1 className={styles.heroTitle}>좋아하는 작품의<br />이벤트 소식을 놓치지 마세요</h1>
                <p className={styles.heroSub}>아직 등록된 이벤트가 없어요. 곧 채워집니다.</p>
              </>
            )}
          </div>

          <div className={styles.statCard}>
            <div className={styles.statTitle}>이번 주 이벤트</div>
            <StatRow label="진행 중" value={stats.ongoing} />
            <StatRow label="오늘 종료" value={stats.endsToday} accent />
            <StatRow label="이번주 시작" value={stats.thisWeek} />
            <button
              className={styles.registerBtn}
              onClick={() => router.push(user ? '/event/new' : '/login?redirect=/event/new')}
            >
              이벤트 등록
            </button>
          </div>
        </div>

        {/* 필터 — 칩 클릭 즉시 반영, 적용 버튼 없음 */}
        <div className={styles.filterBar}>
          <EventFilterBar
            filters={filters}
            onChange={setFilters}
            regions={regions}
            works={works}
            isLoggedIn={!!user}
          />
        </div>

        <Section title="오늘 종료" icon="clock" iconColor="#EF5A5A" desc="오늘이 마지막이에요!" rows={sections.endsToday} onOpen={openEvent} toCard={toCard} onSeeAll={() => router.push('/events/all?section=ends_today')} />
        <Section title="지금 진행 중" icon="fire" iconColor="var(--accent)" desc="추천 순으로 보여드려요" rows={sections.ongoing} onOpen={openEvent} toCard={toCard} scroll onSeeAll={() => router.push('/events/all?section=ongoing')} />
        <Section title="곧 시작" icon="calendar" iconColor="#3B9BE8" desc="다가오는 이벤트를 미리 확인해보세요" rows={sections.upcoming} onOpen={openEvent} toCard={toCard} onSeeAll={() => router.push('/events/all?section=upcoming')} />

        {/* 지난 이벤트 — 눌렀을 때만 불러온다 */}
        <section className={styles.sectionCard}>
          <SectionHeader
            title="지난 이벤트"
            plainIcon
            icon={<EventIcon name="calendar" size={22} color="var(--muted)" />}
            actionLabel="전체보기"
            onAction={() => router.push('/events/all?section=past')}
          />
          {past === null ? (
            <button className={styles.moreBtn} onClick={loadPast} disabled={pastLoading}>
              {pastLoading ? '불러오는 중…' : '더보기'}
            </button>
          ) : past.length === 0 ? (
            <Empty text="지난 이벤트가 없어요." />
          ) : (
            <div className={styles.grid}>
              {past.map(ev => (
                <div key={ev.id} style={{ opacity: .65 }}>
                  <EventCard event={toCard(ev)} onClick={() => openEvent(ev)} />
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className={styles.rail}>
        <EventCalendarWidget items={items} />
        <EventHomeRail
          items={items}
          favoriteTagIds={favoriteTagIds}
          filters={filters}
          onChange={setFilters}
          onOpenEvent={openEvent}
        />
      </aside>
    </div>
  )
}

function Section({
  title, icon, iconColor, desc, rows, onOpen, toCard, scroll, onSeeAll,
}: {
  title: string
  icon: EventIconName
  iconColor: string
  desc: string
  rows: RankedEvent<EventHomeItem>[]
  onOpen: (ev: EventHomeItem) => void
  toCard: (ev: EventHomeItem) => any
  scroll?: boolean
  onSeeAll: () => void
}) {
  if (rows.length === 0) return null   // 빈 섹션은 아예 안 보여준다

  return (
    <section className={styles.sectionCard}>
      <SectionHeader
        title={title}
        plainIcon
        icon={<EventIcon name={icon} size={22} color={iconColor} />}
        actionLabel="전체보기"
        onAction={onSeeAll}
      />
      <p className={styles.sectionDesc}>{desc}</p>
      <div className={scroll ? styles.row : styles.grid}>
        {rows.map(r => (
          <div key={r.event.id} className={scroll ? styles.rowItem : undefined} style={{ position: 'relative' }}>
            <EventCard event={toCard(r.event)} onClick={() => onOpen(r.event)} />
          </div>
        ))}
      </div>
    </section>
  )
}

function StatRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={styles.statRow}>
      <span>{label}</span>
      <strong style={accent ? { color: 'var(--accent)' } : undefined}>{value}</strong>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 13, color: 'var(--muted)', padding: '8px 2px' }}>{text}</div>
}
