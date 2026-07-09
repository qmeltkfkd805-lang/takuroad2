'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { EventIcon } from '@/components/event/EventIcon'
import { shopRegion, shopDistrict } from '@/lib/utils/region'
import { getAllGoodsTypes, GoodsType } from '@/services/goodsTypeService'
import { getActiveWorks, ActiveWork } from '@/services/activeWorksService'
import { getShopHomeItems, getUserShopContext, ShopHomeItem } from '@/services/shopHomeService'
import {
  ShopFilters, EMPTY_FILTERS, applyShopFilters, isDirty,
  paramsToFilters, filtersToParams, SHOP_PRESETS, UserContext,
} from '@/services/shopFilters'
import ShopHomeCard from './ShopHomeCard'
import ShopFilterSidebar from './ShopFilterSidebar'
import styles from './ShopAllPage.module.css'

export default function ShopAllPage() {
  const router = useRouter()
  const params = useSearchParams()
  const { user } = useAuth()

  const [items, setItems] = useState<ShopHomeItem[]>([])
  const [works, setWorks] = useState<ActiveWork[]>([])
  const [goodsTypes, setGoodsTypes] = useState<GoodsType[]>([])
  const [userCtx, setUserCtx] = useState<UserContext>({ favoriteTagIds: new Set(), libraryTagIds: new Set(), savedShopIds: new Set() })
  const [loading, setLoading] = useState(true)
  const [filterOpen, setFilterOpen] = useState(params?.get('filter') === '1')

  // URL → 필터
  const [filters, setFilters] = useState<ShopFilters>(() => paramsToFilters(new URLSearchParams(params?.toString() ?? '')))

  useEffect(() => {
    Promise.all([getShopHomeItems(), getActiveWorks(200), getAllGoodsTypes()])
      .then(([shops, w, g]) => { setItems(shops); setWorks(w); setGoodsTypes(g) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) return
    getUserShopContext(user.id)
      .then(c => setUserCtx({
        favoriteTagIds: new Set(c.favoriteTagIds),
        libraryTagIds: new Set(c.libraryTagIds),
        savedShopIds: new Set(c.savedShopIds),
      }))
      .catch(() => {})
  }, [user])

  // 필터 → URL (뒤로가기·공유 가능하게)
  const update = (f: ShopFilters) => {
    setFilters(f)
    const qs = filtersToParams(f).toString()
    router.replace(qs ? `/shops/all?${qs}` : '/shops/all', { scroll: false })
  }

  // 지역별 구 목록
  const districtsByRegion = useMemo(() => {
    const map: Record<string, Set<string>> = {}
    for (const s of items) {
      const r = shopRegion({ region: s.region, addr: s.addr })
      const d = shopDistrict({ district: s.district, addr: s.addr })
      if (!r || !d) continue
      ;(map[r] ??= new Set()).add(d)
    }
    return Object.fromEntries(Object.entries(map).map(([k, v]) => [k, [...v].sort()]))
  }, [items])

  const rows = useMemo(
    () => applyShopFilters(items, filters, userCtx),
    [items, filters, userCtx],
  )

  const dirty = isDirty(filters)
  const activeCount =
    filters.workSlugs.length + filters.cats.length + filters.goodsSlugs.length +
    (filters.region ? 1 : 0) + (filters.district ? 1 : 0) +
    [filters.openNow, filters.excludeClosedToday, filters.hasEvent,
     filters.verified, filters.claimed, filters.featured, !!filters.mine].filter(Boolean).length

  return (
    <div className={styles.page}>
      <nav className={styles.crumbs}>
        <button onClick={() => router.push('/')}>홈</button><span>›</span>
        <button onClick={() => router.push('/shops')}>샵</button><span>›</span>
        <strong>전체 샵</strong>
      </nav>

      {/* 프리셋 — "오늘 뭐 사러 갈까?" */}
      <div className={styles.presets}>
        <span className={styles.presetLabel}>오늘 뭐 사러 갈까?</span>
        {SHOP_PRESETS.map(p => (
          <button key={p.id} className={styles.preset} onClick={() => update({ ...EMPTY_FILTERS, ...p.patch })}>
            <EventIcon name={p.icon as any} size={15} color={p.color} />{p.label}
          </button>
        ))}
      </div>

      <div className={styles.resultHead}>
        <button
          className={dirty ? styles.filterBtnOn : styles.filterBtn}
          onClick={() => setFilterOpen(o => !o)}
        >
          <EventIcon name="tag" size={15} />
          필터{dirty ? ` · ${activeCount}` : ''}
        </button>
        <span className={styles.count}>{loading ? '불러오는 중…' : `${rows.length}개 샵`}</span>
        <select
          className={styles.sort}
          value={filters.sort}
          onChange={e => update({ ...filters, sort: e.target.value as ShopFilters['sort'] })}
        >
          <option value="hot">인기순</option>
          <option value="reviews">후기 많은순</option>
          <option value="saves">찜 많은순</option>
          <option value="recent">최근 등록순</option>
        </select>
      </div>

      {/* 필터 패널 — 버튼으로 열고 닫는다 */}
      {filterOpen && (
        <>
          <div className={styles.scrim} onClick={() => setFilterOpen(false)} />
          <aside className={styles.panel}>
            <div className={styles.panelHead}>
              <strong>필터</strong>
              {dirty && <button className={styles.reset} onClick={() => update(EMPTY_FILTERS)}>초기화</button>}
              <button className={styles.panelClose} onClick={() => setFilterOpen(false)} aria-label="닫기">✕</button>
            </div>
            <div className={styles.panelBody}>
              <ShopFilterSidebar
                filters={filters}
                onChange={update}
                works={works}
                goodsTypes={goodsTypes}
                districtsByRegion={districtsByRegion}
                loggedIn={!!user}
              />
            </div>
            <div className={styles.panelFoot}>
              <button className={styles.applyBtn} onClick={() => setFilterOpen(false)}>
                {loading ? '…' : `${rows.length}개 샵 보기`}
              </button>
            </div>
          </aside>
        </>
      )}

      {loading ? (
        <div className={styles.skeleton} />
      ) : rows.length === 0 ? (
        <div className={styles.empty}>
          <p>조건에 맞는 샵이 없어요.</p>
          {dirty && <button onClick={() => update(EMPTY_FILTERS)}>필터 초기화</button>}
        </div>
      ) : (
        <div className={styles.grid}>
          {rows.map(s => <ShopHomeCard key={s.id} shop={s} />)}
        </div>
      )}
    </div>
  )
}
