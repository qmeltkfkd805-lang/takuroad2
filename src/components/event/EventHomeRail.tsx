'use client'
import { ReactNode } from 'react'
import { EventHomeItem } from '@/services/eventHomeService'
import { EventFilters, TYPE_LABEL } from './EventFilterBar'
import { EventHomeType } from '@/services/eventHomeService'
import { EventIcon, EventIconName } from './EventIcon'

interface Props {
  items: EventHomeItem[]          // 필터 적용 전 전체 (레일은 "지금 뭐가 있나"를 보여주는 곳)
  favoriteTagIds: Set<string>
  filters: EventFilters
  onChange: (next: EventFilters) => void
  onOpenEvent: (item: EventHomeItem) => void
}

function countBy<K extends string>(items: EventHomeItem[], key: (i: EventHomeItem) => K | null) {
  const map = new Map<K, number>()
  for (const i of items) {
    const k = key(i)
    if (k) map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export default function EventHomeRail({ items, favoriteTagIds, filters, onChange, onOpenEvent }: Props) {
  const favorites = items.filter(i => i.tagId && favoriteTagIds.has(i.tagId))
  const byRegion = countBy(items, i => i.region)
  const byType = countBy<EventHomeType>(items, i => i.type)
  const byWork = countBy(items, i => (i.workName ? `${i.tagId}|${i.workName}` : null)).slice(0, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {favorites.length > 0 && (
        <RailCard title="내 최애 작품 이벤트" icon="heart">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {favorites.slice(0, 4).map(ev => (
              <button key={ev.id} onClick={() => onOpenEvent(ev)} style={rowBtn}>
                <div style={{
                  width: 40, height: 52, borderRadius: 8, flexShrink: 0, overflow: 'hidden',
                  background: 'var(--surface2)',
                }}>
                  {ev.coverUrl && <img src={ev.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
                <div style={{ minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{ev.workName}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                </div>
              </button>
            ))}
          </div>
        </RailCard>
      )}

      <RailCard title="지역별 이벤트" icon="pin">
        <CountList
          rows={byRegion.map(([r, n]) => ({ key: r, label: r, count: n, on: filters.region === r }))}
          onPick={r => onChange({ ...filters, region: filters.region === r ? null : r })}
          empty="주소가 등록된 샵의 이벤트가 아직 없어요."
        />
      </RailCard>

      <RailCard title="이벤트 종류" icon="party">
        <CountList
          rows={byType.map(([t, n]) => ({ key: t, label: TYPE_LABEL[t], count: n, on: filters.type === t }))}
          onPick={t => onChange({ ...filters, type: filters.type === t ? null : (t as EventHomeType) })}
          empty="아직 이벤트가 없어요."
        />
      </RailCard>

      <RailCard title="인기 태그" icon="tag">
        {byWork.length === 0 ? (
          <Empty text="아직 작품이 연결된 이벤트가 없어요." />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {byWork.map(([key]) => {
              const [tagId, name] = key.split('|')
              const on = filters.tagId === tagId
              return (
                <button
                  key={key}
                  onClick={() => onChange({ ...filters, tagId: on ? null : tagId })}
                  style={{
                    padding: '6px 12px', borderRadius: 9999, cursor: 'pointer', fontFamily: 'inherit',
                    border: 'none', fontSize: 12.5, fontWeight: 700,
                    background: on ? 'var(--accent)' : 'var(--surface2)',
                    color: on ? '#fff' : 'var(--accent)',
                  }}
                >
                  #{name}
                </button>
              )
            })}
          </div>
        )}
      </RailCard>
    </div>
  )
}

function RailCard({ title, icon, children }: { title: string; icon: EventIconName; children: ReactNode }) {
  return (
    <section style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 16,
    }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, margin: '0 0 12px' }}>
        <EventIcon name={icon} size={16} color="var(--accent)" />
        {title}
      </h3>
      {children}
    </section>
  )
}

function CountList({
  rows, onPick, empty,
}: {
  rows: { key: string; label: string; count: number; on: boolean }[]
  onPick: (key: string) => void
  empty: string
}) {
  if (rows.length === 0) return <Empty text={empty} />
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {rows.map(r => (
        <button
          key={r.key}
          onClick={() => onPick(r.key)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '9px 8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: r.on ? 'var(--accent-l)' : 'transparent',
            color: r.on ? 'var(--accent)' : 'var(--text)',
            fontFamily: 'inherit', fontSize: 13, fontWeight: r.on ? 800 : 600,
          }}
        >
          <span>{r.label}</span>
          <span style={{ fontSize: 12.5, color: r.on ? 'var(--accent)' : 'var(--muted)', fontWeight: 700 }}>{r.count}</span>
        </button>
      ))}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6, padding: '4px 2px' }}>{text}</div>
}

const rowBtn: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'center', width: '100%',
  border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
}
