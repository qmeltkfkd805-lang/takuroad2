'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { floorGroupKey, floorGroupLabel, hasFloorGroups } from '@/lib/route/autoOrder'
import { formatDistance } from '@/hooks/useCurrentLocation'
import { CATEGORY_NAME_MAP } from '@/lib/constants/categories'
import AppIcon from '@/components/tds/AppIcon'
import s from './RouteCourseMobile.module.css'

/* ============================================================
   📱 모바일 루트 상세 > 코스 안내
   왼쪽 좁은 번호·연결선 레일 + 세로 카드
     사진(60px) + 매장명 / 영업 상태·층 / 주소(카드 전체 폭) / 카테고리 / [지도 보기 | 방문 체크·방문함]
   카드 사이: 도보 시간·거리(루트 저장 때 계산해 route_shops 에 저장된 값) + 이동 팁
   동작(지도 이동·방문 체크·완주)은 부모(RouteDetailPage)의 함수를 그대로 쓴다.
   ============================================================ */

function Svg({ size = 16, color = 'currentColor', children }: { size?: number; color?: string; children: ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>{children}</svg>
}
const PinIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Svg>
const CheckIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="m5 12 5 5L20 6" /></Svg>
const MapIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></Svg>
const ShopIcon = (p: { size?: number; color?: string }) => <Svg {...p}><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10h18M9 20v-6h6v6" /></Svg>

export interface CourseStatus { text: string; tone: string }

/** 영업 상태 → 배지 문구·톤 (루트 상세·루트 지도 시트 공용) */
export function statusPillOf(kind: string | null | undefined): CourseStatus | null {
  switch (kind) {
    case 'open': return { text: '영업 중', tone: 'open' }
    case 'closing_soon': return { text: '곧 마감', tone: 'soon' }
    case 'before': return { text: '영업 전', tone: 'before' }
    case 'dayoff': return { text: '휴무', tone: 'off' }
    case 'temp_closed': return { text: '임시 휴무', tone: 'off' }
    case 'closed': return { text: '영업 종료', tone: 'off' }
    case 'permanently_closed': return { text: '폐점', tone: 'off' }
    default: return null
  }
}

export default function RouteCourseMobile({ stops, visitedIds, selectedId, onSelect, onToggleVisit, onOpenMap, statusOf, floorMaps = {} }: {
  stops: any[]
  visitedIds: Set<string>
  selectedId: string | null
  onSelect: (id: string | null) => void
  onToggleVisit: (shopId: string) => void
  onOpenMap: (shopId: string) => void
  statusOf: (shop: any) => CourseStatus | null
  /** 층 지도 이미지 — 층별 묶음 키(floorGroupKey) → 이미지 주소 */
  floorMaps?: Record<string, { url: string; sourceName?: string | null; sourceUrl?: string | null }>
}) {
  const list = stops.filter(rs => rs?.shops)
  const grouped = hasFloorGroups(list.map(rs => rs.shops))
  const [mapView, setMapView] = useState<{ url: string; label: string; sourceName?: string | null; sourceUrl?: string | null } | null>(null)
  return (
    <>
    <ol className={s.list}>
      {list.map((rs: any, i: number) => {
        const shop = rs.shops
        const sel = selectedId === shop.id
        const st = statusOf(shop)
        const cats: string[] = Array.isArray(shop.cats) ? shop.cats : []
        const first = i === 0, last = i === list.length - 1
        const walkMin: number | null = rs.duration_from_prev_min ?? null
        const walkM: number | null = rs.distance_from_prev_m ?? null
        const tip: string | null = !first ? list[i - 1]?.move_tip ?? null : null
        const visited = visitedIds.has(shop.id)
        const fl = shop.floor_info || [shop.floor, shop.unit].filter(Boolean).join(' ')
        const img: string | undefined = shop.shop_images?.[0]?.image_url
        const hasTravel = !first && (walkMin != null || walkM != null)
        // 층별 묶음 제목 — 앞 샵과 건물·층이 달라지는 곳마다 ("AK플라자 · 5층" + 층 지도)
        const gKey = floorGroupKey(shop)
        const showHead = grouped && (first || floorGroupKey(list[i - 1].shops) !== gKey)
        const gLabel = floorGroupLabel(shop)
        const fm = floorMaps[gKey]
        return (
          <li key={rs.id ?? shop.id} className={s.item}>
            {(hasTravel || tip) && (
              <>
                <div className={s.railGap} aria-hidden><span className={s.line} /></div>
                <div className={s.travel}>
                  {hasTravel && (
                    <div className={s.travelLine}>
                      <AppIcon name="route" size={13} color="var(--muted)" />
                      도보{walkMin != null ? ` ${walkMin}분` : ''}{walkM != null ? ` · ${formatDistance(walkM)}` : ''}
                    </div>
                  )}
                  {tip && <div className={s.tip}><b>이동 팁</b>{tip}</div>}
                </div>
              </>
            )}
            {showHead && (
              <>
                <div className={s.railGap} aria-hidden>{!first && <span className={s.line} />}</div>
                <div className={s.groupHead}>
                  <span className={s.groupLabel}>{gLabel}</span>
                  {fm && (
                    <button type="button" className={s.groupMapBtn} onClick={() => setMapView({ ...fm, label: gLabel })}>
                      <MapIcon size={14} />층 지도 보기
                    </button>
                  )}
                </div>
              </>
            )}
            <div className={s.rail} aria-hidden>
              <span className={`${s.num} ${visited ? s.numDone : ''}`}>{visited ? <CheckIcon size={14} color="#fff" /> : i + 1}</span>
              {!last && <span className={s.line} />}
            </div>
            <div className={`${s.card} ${sel ? s.cardSel : ''}`} onClick={() => onSelect(sel ? null : shop.id)}>
              <div className={s.top}>
                <div className={s.thumb}>
                  {img ? <img src={img} alt="" loading="lazy" /> : <ShopIcon size={22} color="var(--muted)" />}
                </div>
                <div className={s.head}>
                  <Link href={`/shop/${shop.slug}`} className={s.name} onClick={e => e.stopPropagation()}>
                    <span className={s.srOnly}>{i + 1}번 </span>{shop.name}
                  </Link>
                  {(st || fl) && (
                    <div className={s.meta}>
                      {st && <span className={s.status} data-tone={st.tone}>{st.text}</span>}
                      {fl && <span className={s.floor}>{fl}</span>}
                    </div>
                  )}
                </div>
              </div>
              {shop.addr && <div className={s.addr}><PinIcon size={13} color="var(--muted)" /><span>{shop.addr}</span></div>}
              {cats.length > 0 && (
                <div className={s.tags}>
                  {cats.slice(0, 3).map(c => {
                    const ci = (CATEGORY_NAME_MAP as any)[c]
                    return <span key={c} className={s.tag} style={ci ? { color: ci.color, background: ci.bgColor } : undefined}>{c}</span>
                  })}
                </div>
              )}
              <div className={s.btns}>
                {shop.lat && shop.lng ? (
                  <button type="button" className={s.mapBtn} onClick={e => { e.stopPropagation(); onOpenMap(shop.id) }}>
                    <MapIcon size={16} />지도 보기
                  </button>
                ) : (
                  <span className={`${s.mapBtn} ${s.mapBtnOff}`} aria-disabled="true">좌표 없음</span>
                )}
                <button type="button" className={visited ? s.visitOn : s.visit} aria-pressed={visited}
                  onClick={e => { e.stopPropagation(); onToggleVisit(shop.id) }}>
                  {visited ? <><CheckIcon size={16} color="#15803d" />방문함</> : <><PinIcon size={16} color="var(--accent)" />방문 체크</>}
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
    {mapView && (
      <div className={s.mapView} role="dialog" aria-modal="true" aria-label={`${mapView.label} 층 지도`} onClick={() => setMapView(null)}>
        <div className={s.mapViewHead}>
          <span>{mapView.label}</span>
          <button type="button" onClick={() => setMapView(null)} aria-label="닫기">✕</button>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mapView.url} alt={`${mapView.label} 층 지도`} onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  )
}
