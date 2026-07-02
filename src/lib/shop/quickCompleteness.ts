import { Shop } from '@/types/shop'

// 목록용 가벼운 완성도 (이미 불러온 shop 데이터만으로 계산 — 추가 쿼리 없음)
export interface QuickCheck { label: string; ok: boolean }

export function quickCompleteness(s: Shop): { percent: number; checks: QuickCheck[] } {
  const checks: QuickCheck[] = [
    { label: '메인 이미지', ok: (s.images?.length ?? 0) > 0 },
    { label: '주소', ok: !!s.addr },
    { label: '좌표', ok: s.lat != null && s.lng != null },
    { label: '설명', ok: !!s.description },
    { label: '영업시간', ok: !!s.hours },
    { label: '카테고리', ok: (s.cats?.length ?? 0) > 0 },
    { label: '링크', ok: !!s.shop_link },
  ]
  const done = checks.filter((c) => c.ok).length
  return { percent: Math.round((done / checks.length) * 100), checks }
}

// 주소 앞부분에서 지역 추출 (region 컬럼이 비어있어도 "경기 수원시" 식으로 표시)
export function regionFromAddr(addr: string | null): string | null {
  if (!addr) return null
  const parts = addr.trim().split(/\s+/)
  if (parts.length >= 2) return parts[0] + ' ' + parts[1]
  return parts[0] || null
}

// region 있으면 우선, 없으면 addr에서 추출, 그것도 없으면 "지역 미정"
export function shopRegion(s: Shop): string {
  return s.region || regionFromAddr(s.addr) || '지역 미정'
}
