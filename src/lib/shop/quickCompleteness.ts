import { Shop } from '@/types/shop'

// 목록용 가벼운 완성도 (이미 불러온 shop 데이터만으로 계산 — 추가 쿼리 없음)
// 정밀 완성도(이미지/태그/굿즈 개수 포함)는 편집 화면의 getShopCompleteness 사용.
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
