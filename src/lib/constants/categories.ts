export const CATEGORIES = [
  { name: '굿즈샵',      slug: 'goods',       icon: 'goods',      color: '#e8006f', bgColor: 'rgba(232,0,111,.12)' },
  { name: '서점',        slug: 'bookstore',   icon: 'book',       color: '#0891b2', bgColor: 'rgba(8,145,178,.12)' },
  { name: '카드/TCG',    slug: 'tcg',         icon: 'tcg',        color: '#b45309', bgColor: 'rgba(180,83,9,.12)' },
  { name: '중고샵',      slug: 'used',        icon: 'secondhand', color: '#059669', bgColor: 'rgba(5,150,105,.12)' },
  { name: '콜라보카페',  slug: 'collab-cafe', icon: 'cafe',       color: '#ea580c', bgColor: 'rgba(234,88,12,.12)' },
  { name: '음식점/카페', slug: 'restaurant',  icon: 'cafe',       color: '#ca8a04', bgColor: 'rgba(202,138,4,.12)' },
  { name: '팝업스토어',  slug: 'popup',       icon: 'popup',      color: '#0099cc', bgColor: 'rgba(0,153,204,.12)' },
  { name: '게임샵',      slug: 'game',        icon: 'game',       color: '#7c3aed', bgColor: 'rgba(124,58,237,.12)' },
  { name: '프라모델',    slug: 'plamodel',    icon: 'goods',      color: '#2563eb', bgColor: 'rgba(37,99,235,.12)' },
  { name: '온라인숍',    slug: 'online',      icon: 'onlineshop', color: '#16a34a', bgColor: 'rgba(22,163,74,.12)' },
  { name: '가챠',        slug: 'gacha',       icon: 'gacha',      color: '#e03535', bgColor: 'rgba(224,53,53,.12)' },
  { name: '쿠지',        slug: 'kuji',        icon: 'gacha',      color: '#f59e0b', bgColor: 'rgba(245,158,11,.12)' },
  { name: '인형뽑기',    slug: 'claw',        icon: 'gacha',      color: '#c026d3', bgColor: 'rgba(192,38,211,.12)' },
  { name: '전시',        slug: 'exhibition',  icon: 'exhibition', color: '#4f46e5', bgColor: 'rgba(79,70,229,.12)' },
] as const

export type CategorySlug = typeof CATEGORIES[number]['slug']

export const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.slug, c])
) as Record<CategorySlug, typeof CATEGORIES[number]>

export const CATEGORY_NAME_MAP = Object.fromEntries(
  CATEGORIES.map(c => [c.name, c])
)

// 샵 상태 라벨
export const SHOP_STATUS_LABEL: Record<string, string> = {
  pending:          '승인 대기',
  active:           '운영중',
  hidden:           '숨김',
  closed:           '폐업',
  temporary_closed: '임시휴업',
  relocated:        '이전',
  deleted:          '삭제',
}

// 요일 순서
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const WEEKDAY_LABEL: Record<string, string> = {
  mon: '월', tue: '화', wed: '수',
  thu: '목', fri: '금', sat: '토', sun: '일',
}
