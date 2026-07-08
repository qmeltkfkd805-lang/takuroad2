'use client'
import { useState } from 'react'
import BottomSheet from '@/components/bottom-sheet/BottomSheet'
import { EventHomeType } from '@/services/eventHomeService'
import { EventIcon, EventIconName } from './EventIcon'

export type StatusFlag = 'ongoing' | 'ends_today' | 'this_week'

export interface EventFilters {
  region: string | null
  tagId: string | null
  type: EventHomeType | null
  statuses: StatusFlag[]
  favoriteOnly: boolean
}

export const EMPTY_FILTERS: EventFilters = {
  region: null, tagId: null, type: null, statuses: [], favoriteOnly: false,
}

export const TYPE_LABEL: Record<EventHomeType, string> = {
  popup: '팝업스토어', collab_cafe: '콜라보 카페', exhibition: '전시', official_event: '행사',
}

const STATUS_META: Record<StatusFlag, { label: string; icon: EventIconName }> = {
  ongoing:    { label: '진행중',    icon: 'fire' },
  ends_today: { label: '오늘 종료', icon: 'clock' },
  this_week:  { label: '이번주',    icon: 'calendar' },
}

export interface WorkOption { id: string; name: string }

interface Props {
  filters: EventFilters
  onChange: (next: EventFilters) => void
  regions: string[]
  works: WorkOption[]
  isLoggedIn: boolean
}

// 선택 시트 하나로 지역·작품·종류를 다 처리한다
type SheetKind = 'region' | 'work' | 'type' | null

export default function EventFilterBar({ filters, onChange, regions, works, isLoggedIn }: Props) {
  const [sheet, setSheet] = useState<SheetKind>(null)
  const close = () => setSheet(null)

  const dirty =
    !!filters.region || !!filters.tagId || !!filters.type ||
    filters.statuses.length > 0 || filters.favoriteOnly

  const toggleStatus = (s: StatusFlag) => {
    const has = filters.statuses.includes(s)
    onChange({ ...filters, statuses: has ? filters.statuses.filter(x => x !== s) : [...filters.statuses, s] })
  }

  const workName = filters.tagId ? works.find(w => w.id === filters.tagId)?.name : null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <style>{`.taku-noscroll::-webkit-scrollbar{display:none}.taku-noscroll{scrollbar-width:none;-ms-overflow-style:none}`}</style>

      {/* 칩만 스크롤 — 접히지 않고 한 줄 유지 */}
      <div
        className="taku-noscroll"
        style={{ display: 'flex', flexWrap: 'nowrap', gap: 6, alignItems: 'center', overflowX: 'auto', flex: 1, minWidth: 0 }}
      >
      <SelectChip label={filters.region ?? '지역'} icon="pin" on={!!filters.region} onClick={() => setSheet('region')} />
      <SelectChip label={workName ?? '작품'} icon="work" on={!!filters.tagId} onClick={() => setSheet('work')} />
      <SelectChip label={filters.type ? TYPE_LABEL[filters.type] : '종류'} icon="party" on={!!filters.type} onClick={() => setSheet('type')} />

      <span style={{ width: 1, height: 20, background: 'var(--border)', margin: '0 2px', flexShrink: 0 }} />

      {(['ongoing', 'ends_today', 'this_week'] as StatusFlag[]).map(s => (
        <ToggleChip key={s} label={STATUS_META[s].label} icon={STATUS_META[s].icon} on={filters.statuses.includes(s)} onClick={() => toggleStatus(s)} />
      ))}
      {isLoggedIn && (
        <ToggleChip
          label="내 최애"
          icon="heart"
          on={filters.favoriteOnly}
          onClick={() => onChange({ ...filters, favoriteOnly: !filters.favoriteOnly })}
        />
      )}

      </div>

      {dirty && (
        <button
          onClick={() => onChange(EMPTY_FILTERS)}
          style={{
            flexShrink: 0, border: 'none', background: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, color: 'var(--muted)',
          }}
        >
          초기화
        </button>
      )}

      <BottomSheet isOpen={sheet !== null} onClose={close}>
        {sheet === 'region' && (
          <SheetList
            title="지역 선택"
            options={[{ v: null, label: '전체 지역' }, ...regions.map(r => ({ v: r, label: r }))]}
            selected={filters.region}
            onPick={v => { onChange({ ...filters, region: v }); close() }}
          />
        )}
        {sheet === 'work' && (
          <SheetList
            title="작품 선택"
            options={[{ v: null, label: '전체 작품' }, ...works.map(w => ({ v: w.id, label: w.name }))]}
            selected={filters.tagId}
            onPick={v => { onChange({ ...filters, tagId: v }); close() }}
          />
        )}
        {sheet === 'type' && (
          <SheetList
            title="이벤트 종류"
            options={[
              { v: null, label: '전체' },
              ...(Object.keys(TYPE_LABEL) as EventHomeType[]).map(t => ({ v: t, label: TYPE_LABEL[t] })),
            ]}
            selected={filters.type}
            onPick={v => { onChange({ ...filters, type: v as EventHomeType | null }); close() }}
          />
        )}
      </BottomSheet>
    </div>
  )
}

function SelectChip({ label, icon, on, onClick }: { label: string; icon: EventIconName; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={chipStyle(on)}>
      <EventIcon name={icon} size={14} />
      {label}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: .55 }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </button>
  )
}

function ToggleChip({ label, icon, on, onClick }: { label: string; icon: EventIconName; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={chipStyle(on)}>
      <EventIcon name={icon} size={14} />
      {label}
    </button>
  )
}

function chipStyle(on: boolean): React.CSSProperties {
  return {
    flexShrink: 0,
    whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 11px', borderRadius: 9999,
    border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent-l)' : 'var(--surface)',
    color: on ? 'var(--accent)' : 'var(--text)',
    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit',
  }
}

function SheetList<T extends string | null>({
  title, options, selected, onPick,
}: {
  title: string
  options: { v: T; label: string }[]
  selected: T
  onPick: (v: T) => void
}) {
  return (
    <div style={{ padding: '4px 16px 24px' }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: '8px 0 16px' }}>{title}</h3>
      {options.length <= 1 && (
        <div style={{ padding: '14px 4px', fontSize: 13, color: 'var(--muted)' }}>
          아직 고를 수 있는 항목이 없어요.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map(o => {
          const on = o.v === selected
          return (
            <button
              key={String(o.v)}
              onClick={() => onPick(o.v)}
              style={{
                padding: '13px 14px', borderRadius: 12, textAlign: 'left',
                border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                background: on ? 'var(--accent-l)' : 'var(--surface)',
                color: on ? 'var(--accent)' : 'var(--text)',
                fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
