'use client'

import { useState } from 'react'
import { ShopFilters } from '@/services/shopFilters'
import { EventIcon } from '@/components/event/EventIcon'
import { CATEGORIES } from '@/lib/constants/categories'
import { GoodsType } from '@/services/goodsTypeService'
import { ActiveWork } from '@/services/activeWorksService'
import { SIDO } from '@/lib/utils/region'
import styles from './ShopFilterSidebar.module.css'

interface Props {
  filters: ShopFilters
  onChange: (f: ShopFilters) => void
  works: ActiveWork[]
  goodsTypes: GoodsType[]
  districtsByRegion: Record<string, string[]>
  loggedIn: boolean
}

export default function ShopFilterSidebar({
  filters, onChange, works, goodsTypes, districtsByRegion, loggedIn,
}: Props) {
  const set = (patch: Partial<ShopFilters>) => onChange({ ...filters, ...patch })
  const toggle = (key: 'workSlugs' | 'cats' | 'goodsSlugs', v: string) => {
    const cur = filters[key]
    set({ [key]: cur.includes(v) ? cur.filter(x => x !== v) : [...cur, v] } as any)
  }

  const [workQuery, setWorkQuery] = useState('')
  const shownWorks = workQuery
    ? works.filter(w => w.name.replace(/\s/g, '').includes(workQuery.replace(/\s/g, '')))
    : works.slice(0, 12)

  return (
    <div className={styles.bar}>
      {/* 취급 작품 — 가장 중요 */}
      <Group label="취급 작품" icon="work" badge={filters.workSlugs.length}>
        <input
          className={styles.search}
          value={workQuery}
          onChange={e => setWorkQuery(e.target.value)}
          placeholder="작품 검색"
        />
        <div className={styles.chips}>
          {shownWorks.map(w => (
            <button
              key={w.id}
              className={filters.workSlugs.includes(w.slug) ? styles.chipOn : styles.chip}
              onClick={() => toggle('workSlugs', w.slug)}
            >
              {filters.workSlugs.includes(w.slug) && '✓ '}{w.name}
            </button>
          ))}
          {!workQuery && works.length > 12 && (
            <span className={styles.more}>검색으로 더 찾기</span>
          )}
        </div>
      </Group>

      {/* 취급 분야 */}
      {goodsTypes.length > 0 && (
        <Group label="취급 분야" icon="bag" badge={filters.goodsSlugs.length}>
          <div className={styles.chips}>
            {goodsTypes.map(g => (
              <button
                key={g.id}
                className={filters.goodsSlugs.includes(g.slug) ? styles.chipOn : styles.chip}
                onClick={() => toggle('goodsSlugs', g.slug)}
              >
                {filters.goodsSlugs.includes(g.slug) && '✓ '}{g.name}
              </button>
            ))}
          </div>
        </Group>
      )}

      {/* 샵 종류 */}
      <Group label="샵 종류" icon="tag" badge={filters.cats.length}>
        <div className={styles.chips}>
          {CATEGORIES.filter(c => c.slug !== 'online').map(c => (
            <button
              key={c.slug}
              className={filters.cats.includes(c.name) ? styles.chipOn : styles.chip}
              onClick={() => toggle('cats', c.name)}
            >
              {filters.cats.includes(c.name) && '✓ '}{c.name}
            </button>
          ))}
        </div>
      </Group>

      {/* 지역 */}
      <Group label="지역" icon="pin" badge={(filters.region ? 1 : 0) + (filters.district ? 1 : 0)}>
        <select
          className={styles.select}
          value={filters.region ?? ''}
          onChange={e => set({ region: e.target.value || null, district: null })}
        >
          <option value="">전체 지역</option>
          {SIDO.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {filters.region && districtsByRegion[filters.region]?.length > 0 && (
          <select
            className={styles.select}
            value={filters.district ?? ''}
            onChange={e => set({ district: e.target.value || null })}
          >
            <option value="">{filters.region} 전체</option>
            {districtsByRegion[filters.region].map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
      </Group>

      {/* 운영 상태 */}
      <Group label="운영" icon="clock" badge={[filters.openNow, filters.excludeClosedToday, filters.hasEvent].filter(Boolean).length}>
        <Check label="지금 영업중" on={filters.openNow} onClick={() => set({ openNow: !filters.openNow })} />
        <Check label="오늘 휴무 제외" on={filters.excludeClosedToday} onClick={() => set({ excludeClosedToday: !filters.excludeClosedToday })} />
        <Check label="이벤트 진행중" on={filters.hasEvent} onClick={() => set({ hasEvent: !filters.hasEvent })} />
      </Group>

      {/* 내 취향 */}
      {loggedIn && (
        <Group label="내 취향" icon="heart" defaultOpen={false} badge={filters.mine ? 1 : 0}>
          <Radio label="내 최애 작품 취급" on={filters.mine === 'favorite'} onClick={() => set({ mine: filters.mine === 'favorite' ? null : 'favorite' })} />
          <Radio label="내 라이브러리 작품" on={filters.mine === 'library'} onClick={() => set({ mine: filters.mine === 'library' ? null : 'library' })} />
          <Radio label="내가 저장한 샵" on={filters.mine === 'saved'} onClick={() => set({ mine: filters.mine === 'saved' ? null : 'saved' })} />
        </Group>
      )}

      {/* 인증 */}
      <Group label="인증" icon="starFill" defaultOpen={false} badge={[filters.official, filters.featured].filter(Boolean).length}>
        <Check label="공식 인증샵" on={filters.official} onClick={() => set({ official: !filters.official })} />
        <Check label="운영자 추천" on={filters.featured} onClick={() => set({ featured: !filters.featured })} />
      </Group>
    </div>
  )
}

/* ---- 작은 조각 ---- */
function Group({
  label, icon, defaultOpen = true, badge, children,
}: {
  label: string; icon: any; defaultOpen?: boolean; badge?: number; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={styles.group}>
      <button className={styles.groupLabel} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <EventIcon name={icon} size={15} color="var(--accent)" />
        {label}
        {badge ? <span className={styles.groupBadge}>{badge}</span> : null}
        <svg className={open ? styles.chevOpen : styles.chev} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className={styles.groupBody}>{children}</div>}
    </div>
  )
}
function Check({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={styles.check} onClick={onClick}>
      <span className={on ? styles.boxOn : styles.box}>{on && '✓'}</span>{label}
    </button>
  )
}
function Radio({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={styles.check} onClick={onClick}>
      <span className={on ? styles.radioOn : styles.radio} />{label}
    </button>
  )
}
