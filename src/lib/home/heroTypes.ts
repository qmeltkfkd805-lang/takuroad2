// 홈 히어로 공용 타입 — 서버/클라이언트 양쪽에서 import (supabase 의존 없음)

export type HeroCategory = 'event' | 'shop' | 'notice'

// 카드가 어디서 왔는지 — 관리자 목록 배지/디버그용
export type HeroOrigin =
  | 'manual'        // 관리자 수동 슬롯 (유형은 category로 구분)
  | 'auto-fav'      // 자동 · 최애 작품 시작 이벤트
  | 'auto-popular'  // 자동 · 인기 시작 이벤트

// 홈 히어로 슬라이드 한 장에 필요한 최종 표시 데이터
export interface HeroCard {
  /** 슬라이드 고유 key (수동=slot id, 자동=`auto:event:{eventId}`) */
  id: string
  category: HeroCategory
  origin: HeroOrigin
  /** 상단 라벨 (예: "관리자 추천 이벤트", "이번 주 오픈") */
  label: string | null
  /** 큰 제목 */
  headline: string
  /** 한 줄 설명 */
  description: string | null
  imageUrl: string | null
  ctaText: string | null
  ctaHref: string
  /** 이벤트 시작 강조 배지 (예: "3일 뒤 시작", "8.12 OPEN"). 이벤트에만 */
  badge: string | null
  /** 보조 정보 (예: "8.12 시작 · 더현대 서울") */
  meta: string | null
}

// 하단 분류 라벨
export const HERO_CATEGORY_LABEL: Record<HeroCategory, string> = {
  event: '오픈 이벤트',
  shop: '신규 샵',
  notice: '중요 공지',
}

// 관리자 목록 출처 배지 문구
export function heroOriginBadge(card: { origin: HeroOrigin; category: HeroCategory; isPinned?: boolean }): string {
  if (card.origin === 'auto-fav') return '자동 · 최애 작품'
  if (card.origin === 'auto-popular') return '자동 · 인기 시작 이벤트'
  // manual
  if (card.category === 'event') return '관리자 추천 이벤트'
  if (card.category === 'shop') return '검수 완료 신규 샵'
  return card.isPinned ? '중요 공지 · 고정' : '중요 공지'
}
