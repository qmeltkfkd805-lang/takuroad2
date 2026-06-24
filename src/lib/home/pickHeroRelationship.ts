import { WorkRelationship } from '@/types/work-relationship'

// Hero 슬롯에 넣을 "오늘 가장 중요한 관계" 하나 + 보여주는 이유(reason)를 고른다.
// 이 함수가 Hero의 "선택 책임"(정책). 슬롯은 결과만 받아 표시.
// MVP: 최애 중 첫 번째. 미래: 새 굿즈/팝업/재방문 등 우선순위 규칙으로 확장.
export interface HeroPick {
  relationship: WorkRelationship
  reason: string   // 슬롯 상단에 그대로 띄울 이유. 미래엔 "🛍️ 새 굿즈 입고" 등
}

export function pickHeroRelationship(rels: WorkRelationship[]): HeroPick | null {
  // 1순위: 최애
  const favorite = rels.find(r => r.affinity === 'favorite')
  if (favorite) return { relationship: favorite, reason: '❤️ 내 최애' }

  // 2순위: 좋아하는 작품
  const interest = rels.find(r => r.affinity === 'interest')
  if (interest) return { relationship: interest, reason: '⭐ 좋아하는 작품' }

  // 관계가 없으면 Hero 없음 (슬롯은 등록 유도를 대신 보여줌)
  return null
}