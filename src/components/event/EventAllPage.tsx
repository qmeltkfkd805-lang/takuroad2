'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { EventCard } from '@/components/tds'
import { rankEvents, toEventHomeSections } from '@/lib/event/rankEvents'
import { collapseEventSeries } from '@/lib/event/eventSeries'
import {
  EventHomeItem, getEventHomeItems, getPastEventItems, getMyAffinityTagIds,
} from '@/services/eventHomeService'
import { EventIcon, EventIconName } from './EventIcon'

type SectionKey = 'ends_today' | 'ongoing' | 'upcoming' | 'past'

const META: Record<SectionKey, { title: string; desc: string; icon: EventIconName; color: string }> = {
  ends_today: { title: '오늘 종료',    desc: '오늘이 마지막이에요',            icon: 'clock',    color: '#EF5A5A' },
  ongoing:    { title: '지금 진행 중', desc: '추천 순으로 보여드려요',          icon: 'fire',     color: 'var(--accent)' },
  upcoming:   { title: '곧 시작',      desc: '다가오는 이벤트를 미리 확인해보세요', icon: 'calendar', color: '#3B9BE8' },
  past:       { title: '지난 이벤트',  desc: '이미 끝난 이벤트예요',            icon: 'calendar', color: 'var(--muted)' },
}

export default function EventAllPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()

  const key = ((params?.get('section') ?? 'ongoing') as SectionKey)
  const meta = META[key] ?? META.ongoing

  const [items, setItems] = useState<EventHomeItem[]>([])
  // rankEvents는 Set을 받는다 (배열을 주면 favorites.has가 터진다)
  const [favoriteTagIds, setFavoriteTagIds] = useState<Set<string>>(new Set())
  const [interestTagIds, setInterestTagIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // 지난 이벤트만 별도 조회 (홈은 진행/예정만 가져온다)
    const load = key === 'past' ? getPastEventItems(200) : getEventHomeItems()
    load
      .then(rows => { if (alive) setItems(rows) })
      .catch(() => { if (alive) setItems([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [key])

  useEffect(() => {
    if (!user) { setFavoriteTagIds(new Set()); setInterestTagIds(new Set()); return }
    getMyAffinityTagIds(user.id)
      .then(({ favorites, interests }) => {
        setFavoriteTagIds(new Set(favorites))
        setInterestTagIds(new Set(interests))
      })
      .catch(() => {})
  }, [user])

  // rankEvents는 끝난 이벤트를 걸러내므로 지난 이벤트에는 쓰지 않는다.
  // 반환 형태를 { event, isFavorite }로 통일해 아래 렌더가 한 갈래로 돌게 한다.
  // ⭐ 접기는 항상 정렬 뒤에 (이벤트 홈과 같은 규칙)
  const rows = useMemo(() => {
    if (key === 'past') {
      return collapseEventSeries(items)
        .map(event => ({ event, isFavorite: !!event.tagId && favoriteTagIds.has(event.tagId) }))
    }
    const sections = toEventHomeSections(rankEvents(items, { favoriteTagIds }))
    const picked =
      key === 'ends_today' ? sections.endsToday :
      key === 'upcoming'   ? sections.upcoming  :
                             sections.ongoing
    return collapseEventSeries(picked.map(r => r.event))
      .map(event => ({ event, isFavorite: !!event.tagId && favoriteTagIds.has(event.tagId) }))
  }, [items, favoriteTagIds, key])

  const toCard = (ev: EventHomeItem & { branchCount?: number }) => ({
    id: ev.id, title: ev.title, type: ev.type,
    workName: ev.workName,
    // 여러 지점 이벤트는 대표 지점 + "외 N곳"
    place: (ev.branchCount ?? 1) > 1
      ? `${ev.placeName ?? ev.shopName ?? ''} 외 ${(ev.branchCount ?? 1) - 1}곳`
      : (ev.placeName ?? ev.shopName),
    startDate: ev.startDate, endDate: ev.endDate, coverUrl: ev.coverUrl,
    affinity: ev.tagId && favoriteTagIds.has(ev.tagId) ? ('favorite' as const)
            : ev.tagId && interestTagIds.has(ev.tagId) ? ('interest' as const)
            : null,
  })

  return (
    <div style={{ width: '100%', maxWidth: 1320, margin: '0 auto', padding: '24px 32px 72px', boxSizing: 'border-box' }}>
      <nav style={crumbs}>
        <button onClick={() => router.push('/')} style={crumbBtn}>홈</button>
        <span>›</span>
        <button onClick={() => router.push('/events')} style={crumbBtn}>이벤트</button>
        <span>›</span>
        <strong style={{ color: 'var(--text)' }}>{meta.title}</strong>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <EventIcon name={meta.icon} size={26} color={meta.color} />
        <h1 style={{ fontSize: 28, fontWeight: 900, margin: 0 }}>{meta.title}</h1>
        {!loading && (
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--muted)' }}>{rows.length}개</span>
        )}
      </div>
      <p style={{ fontSize: 14.5, color: 'var(--muted)', margin: '0 0 26px' }}>{meta.desc}</p>

      {loading ? (
        <div style={{ height: 320, borderRadius: 18, background: 'var(--surface2)' }} />
      ) : rows.length === 0 ? (
        <div style={{ padding: '80px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>
          해당하는 이벤트가 없어요.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20, width: '100%' }}>
          {rows.map(r => (
            <div key={r.event.id} style={{ opacity: key === 'past' ? .65 : 1 }}>
              <EventCard event={toCard(r.event)} onClick={() => router.push(`/event/${r.event.id}`)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const crumbs: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
  fontSize: 12.5, color: 'var(--muted)', marginBottom: 16,
}
const crumbBtn: React.CSSProperties = {
  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
  fontFamily: 'inherit', fontSize: 12.5, color: 'var(--muted)',
}
