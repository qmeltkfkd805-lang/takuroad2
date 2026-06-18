export const CATEGORIES = [
  { name: '애니/웹툰',   slug: 'anime',     icon: '🌸', color: '#e8006f', bgColor: 'rgba(232,0,111,.12)' },
  { name: '피규어',      slug: 'figure',    icon: '🗿', color: '#7c3aed', bgColor: 'rgba(124,58,237,.12)' },
  { name: '카드/TCG',    slug: 'tcg',       icon: '🃏', color: '#b45309', bgColor: 'rgba(180,83,9,.12)' },
  { name: '중고/빈티지', slug: 'vintage',   icon: '📦', color: '#059669', bgColor: 'rgba(5,150,105,.12)' },
  { name: '팝업/카페',   slug: 'popup',     icon: '🎪', color: '#0099cc', bgColor: 'rgba(0,153,204,.12)' },
  { name: '동인지',      slug: 'doujin',    icon: '🖨️', color: '#db2777', bgColor: 'rgba(219,39,119,.12)' },
  { name: '게임',        slug: 'game',      icon: '🎮', color: '#ea580c', bgColor: 'rgba(234,88,12,.12)' },
  { name: '쿠지',        slug: 'kuji',      icon: '🎰', color: '#e03535', bgColor: 'rgba(224,53,53,.12)' },
  { name: '프라모델',    slug: 'pla-model', icon: '🔧', color: '#0891b2', bgColor: 'rgba(8,145,178,.12)' },
  { name: '온라인샵',    slug: 'online',    icon: '🛒', color: '#16a34a', bgColor: 'rgba(22,163,74,.12)' },
] as const

export type CategorySlug = typeof CATEGORIES[number]['slug']

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.slug, c])
) as Record<CategorySlug, typeof CATEGORIES[number]>

export const CATEGORY_NAME_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.name, c])
)

// 샵 상태 레이블
export const SHOP_STATUS_LABEL: Record<string, string> = {
  pending:          '승인 대기',
  active:           '운영중',
  hidden:           '숨김',
  closed:           '폐업',
  temporary_closed: '임시휴업',
  deleted:          '삭제',
}

// 요일 순서
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const WEEKDAY_LABEL: Record<string, string> = {
  mon: '월', tue: '화', wed: '수',
  thu: '목', fri: '금', sat: '토', sun: '일',
}
