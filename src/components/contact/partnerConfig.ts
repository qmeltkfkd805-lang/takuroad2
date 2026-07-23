// 제휴 유형별 추가 필드 정의 — 이 파일만 고치면 폼이 바뀐다.
export type PFieldKey =
  | 'address' | 'works' | 'branches'
  | 'eventName' | 'eventPeriod' | 'eventPlace'
  | 'brandName' | 'brandGoal'
  | 'adPeriod' | 'adPlace' | 'adBudget' | 'partnerKind'

export type PFieldDef = { label: string; placeholder?: string; multiline?: boolean }

export const P_FIELD_DEFS: Record<PFieldKey, PFieldDef> = {
  address:     { label: '매장 주소', placeholder: '매장이 위치한 주소' },
  works:       { label: '취급 작품', placeholder: '주로 취급하는 작품·브랜드' },
  branches:    { label: '지점 수', placeholder: '예: 3개' },
  eventName:   { label: '행사명', placeholder: '팝업·전시·행사 이름' },
  eventPeriod: { label: '행사 기간', placeholder: '예: 2026.08.01 ~ 08.15' },
  eventPlace:  { label: '행사 장소', placeholder: '개최 장소' },
  brandName:   { label: '브랜드명', placeholder: '브랜드 이름' },
  brandGoal:   { label: '협업 목적', placeholder: '어떤 협업을 원하시나요?', multiline: true },
  adPeriod:    { label: '예상 기간', placeholder: '예: 2주' },
  adPlace:     { label: '희망 위치', placeholder: '예: 홈 배너, 지도 추천' },
  adBudget:    { label: '예산 (선택)', placeholder: '대략적인 예산' },
  partnerKind: { label: '원하시는 제휴 내용', placeholder: '어떤 제휴를 원하시는지 자유롭게 적어주세요', multiline: true },
}

export type PartnerType = { key: string; label: string; fields: PFieldKey[]; redirect?: { href: string; label: string; desc: string } }

export const PARTNER_TYPES: PartnerType[] = [
  { key: 'shop',    label: '굿즈샵 등록·인증', fields: [], redirect: { href: '/shop/new', label: '샵 등록하러 가기', desc: '굿즈샵은 제휴 문의 없이 직접 등록하고 사장님 인증까지 받을 수 있어요!' } },
  { key: 'event',   label: '이벤트·팝업 홍보', fields: [], redirect: { href: '/event/new', label: '이벤트 등록하러 가기', desc: '팝업·전시·행사는 이벤트 등록 기능으로 직접 올릴 수 있어요!' } },
  { key: 'brand',   label: '브랜드·기업 제휴', fields: ['brandName', 'brandGoal'] },
  { key: 'ad',      label: '광고·프로모션',    fields: ['adPeriod', 'adPlace', 'adBudget'] },
  { key: 'content', label: '콘텐츠 협업',      fields: [] },
  { key: 'etc',     label: '기타',            fields: [] },
]

export const COLLAB_FIELDS = [
  '굿즈샵 등록', '이벤트 등록', '할인 이벤트', '공동 프로모션', 'SNS 홍보', '광고', '기타',
]