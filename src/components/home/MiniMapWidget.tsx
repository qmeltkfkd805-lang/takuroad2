'use client'

import { useRef, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Shop } from '@/types/shop'
import { HotMapData } from '@/lib/home/hotMap'
import KakaoMap, { KakaoMapRef } from '@/components/map/KakaoMap'
import { CATEGORIES } from '@/lib/constants/categories'
import { getTodayStatus } from '@/lib/utils/date'
import { useAuth } from '@/components/layout/AuthProvider'
import { useSaved } from '@/hooks/useSaved'
import { getUserShopContext } from '@/services/shopHomeService'
import styles from './rail.module.css'
import AppIcon from '@/components/tds/AppIcon'

interface Props {
  shops: Shop[]
  hotMap: HotMapData
  eventCount: number
}

const dispLat = (s: any) => s.displayLat ?? s.lat
const dispLng = (s: any) => s.displayLng ?? s.lng

// 온라인샵(좌표 없음)은 지도에서 제외
const onMap = (s: Shop) => !!dispLat(s) && !!dispLng(s) && !s.cats?.includes('온라인샵')

// 샵들이 퍼진 정도에 맞춰 지도 레벨 선택 (작을수록 확대)
function levelForSpan(span: number) {
  if (span < 0.01) return 4
  if (span < 0.03) return 5
  if (span < 0.06) return 6
  if (span < 0.12) return 7
  if (span < 0.25) return 8
  return 9
}

// 미니맵 아래 대표 샵: 저장한 샵 우선 → 운영중 우선 → 방문수 높은 순
function pickFeatured(shops: Shop[], n: number, savedIds: Set<string>): Shop[] {
  const sorted = [...shops].sort((a, b) => {
    const aSaved = savedIds.has(a.id) ? 1 : 0
    const bSaved = savedIds.has(b.id) ? 1 : 0
    if (aSaved !== bSaved) return bSaved - aSaved
    const aOpen = a.status === 'active' ? 1 : 0
    const bOpen = b.status === 'active' ? 1 : 0
    if (aOpen !== bOpen) return bOpen - aOpen
    return (b.visit_count ?? 0) - (a.visit_count ?? 0)
  })
  return sorted.slice(0, n)
}

export default function MiniMapWidget({ shops, hotMap }: Props) {
  const { center, hotRegions } = hotMap
  const { user } = useAuth()
  const router = useRouter()
  const { isSaved, toggleSave } = useSaved()
  const mapRef = useRef<KakaoMapRef>(null)
  const [selectedCat, setSelectedCat] = useState('전체')
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  // 저장한 샵 — 목록에서 우선 노출
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return }
    let alive = true
    getUserShopContext(user.id)
      .then((c) => { if (alive) setSavedIds(new Set(c.savedShopIds)) })
      .catch(() => {})
    return () => { alive = false }
  }, [user])

  // 카테고리 바꾸면 핀 선택 해제
  useEffect(() => { setSelectedShop(null) }, [selectedCat])

  // 선택 카테고리로 필터한 샵 (지도·목록 공통)
  const filteredShops = useMemo(() => {
    if (selectedCat === '전체') return shops
    return shops.filter((s) => s.cats?.includes(selectedCat))
  }, [shops, selectedCat])

  const mapShops = useMemo(() => filteredShops.filter(onMap), [filteredShops])

  const featured = useMemo(
    () => pickFeatured(filteredShops.filter((s) => s.id !== selectedShop?.id), 3, savedIds),
    [filteredShops, selectedShop, savedIds],
  )

  // 지도 중심: 선택 샵 → 없으면 목록 맨 위 샵 → 없으면 지역 중심
  const topShop = featured[0] ?? null
  useEffect(() => {
    const target = selectedShop ?? topShop
    let n = 0
    const iv = setInterval(() => {
      mapRef.current?.relayout()
      if (target) mapRef.current?.moveCenter(dispLat(target) as number, dispLng(target) as number, 5)
      else if (center) mapRef.current?.moveCenter(center.lat, center.lng, 6)
      if (++n >= 8) clearInterval(iv)
    }, 250)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedShop?.id, topShop?.id, center])
  const allHref = selectedCat === '전체' ? '/shops/all' : `/shops/all?cats=${encodeURIComponent(selectedCat)}`

  const onHeart = (e: React.MouseEvent, shop: Shop) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { router.push('/login'); return }
    toggleSave(shop.id)
  }

  const renderCard = (shop: Shop, picked: boolean) => {
    const today = getTodayStatus(shop.hours)
    const dotColor = today.isOpen ? '#3ddc97' : '#ff8a8a'
    const saved = isSaved(shop.id)
    return (
      <Link key={shop.id} href={`/shop/${shop.slug}`} className={picked ? styles.mapShopCardOn : styles.mapShopCard}>
        <span className={styles.mapShopThumb}>
          {shop.images?.[0] ? <img src={shop.images[0]} alt="" /> : <AppIcon name="shop" size={22} color="var(--muted)" />}
        </span>
        <span className={styles.mapShopBody}>
          {picked && (
            <span className={styles.mapPinLabel}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" /></svg>
              선택한 샵
            </span>
          )}
          <span className={styles.mapShopName}>{shop.name}</span>
          <span className={styles.mapShopMeta}>
            {today.label && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: 9999, background: dotColor, flexShrink: 0 }} />
                <span style={{ color: today.isOpen ? 'var(--green)' : 'var(--red)', fontWeight: 800 }}>{today.label}</span>
                {today.todayHours && <span style={{ color: 'var(--muted)', fontWeight: 600 }}>· {today.todayHours}</span>}
              </span>
            )}
          </span>
        </span>
        <button className={styles.mapShopHeart} onClick={(e) => onHeart(e, shop)} aria-pressed={saved} aria-label={saved ? '저장 해제' : '저장'}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? '#FF5692' : 'none'} stroke={saved ? '#FF5692' : 'var(--muted)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.5 4.04 3 5.5l7 7Z" /></svg>
        </button>
      </Link>
    )
  }

  return (
    <div className={styles.widget}>
      <div className={styles.widgetHead}>
        <span className={styles.widgetTitle}>덕질 지도</span>
        <Link href="/map" className={styles.widgetMore}>전체 지도 보기</Link>
      </div>

      <div className={styles.mapChips}>
        <button
          type="button"
          className={selectedCat === '전체' ? styles.mapChipOn : styles.mapChip}
          onClick={() => setSelectedCat('전체')}
        >
          전체
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            className={selectedCat === c.name ? styles.mapChipOn : styles.mapChip}
            onClick={() => setSelectedCat(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className={styles.miniMap}>
        <span className={styles.miniMapInner}>
          <KakaoMap
            ref={mapRef}
            shops={filteredShops}
            activeShopId={(selectedShop ?? topShop)?.id ?? null}
            myLocation={null}
            onSelectShop={setSelectedShop}
            onMapClick={() => setSelectedShop(null)}
            onSelectGroup={(g) => setSelectedShop(g[0] ?? null)}
          />
        </span>
        {selectedCat === '전체' && hotRegions.length > 0 && (
          <span className={styles.hotBadge}>
            <b>오늘 HOT</b>
            <span>{hotRegions.join(' · ')}</span>
          </span>
        )}
      </div>

      {selectedShop && renderCard(selectedShop, true)}

      {featured.length > 0 ? (
        featured.map((shop) => renderCard(shop, false))
      ) : !selectedShop ? (
        <div className={styles.mapShopEmpty}>이 카테고리의 샵이 아직 없어요.</div>
      ) : null}

      <Link href={allHref} className={styles.mapAllBtn}>
        샵 전체보기
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </Link>
    </div>
  )
}
