export type MemorialKind =
  | 'route-complete'
  | 'collection-complete'
  | 'first-checkin'
  | 'year-report'

export type MemorialType =
  | 'goods-shop-tour'
  | 'popup-tour'
  | 'cafe-tour'
  | 'mixed-tour'

export const TYPE_LABEL: Record<MemorialType, string> = {
  'goods-shop-tour': '굿즈샵 투어',
  'popup-tour': '팝업 투어',
  'cafe-tour': '콜라보 카페',
  'mixed-tour': '복합 투어',
}
export const TYPE_CATEGORY: Record<MemorialType, string> = {
  'goods-shop-tour': '굿즈샵',
  'popup-tour': '팝업스토어',
  'cafe-tour': '콜라보 카페',
  'mixed-tour': '여행지',
}

export interface MemorialData {
  kind: MemorialKind
  rallyNo: string
  routeName: string
  area?: string
  type?: MemorialType
  walkTime?: number
  shopCount?: number
  date: string
  stampKind?: string
  takuPose?: string
}

export const KIND_TICKET_LABEL: Record<MemorialKind, string> = {
  'route-complete': 'ROUTE',
  'collection-complete': 'COLLECTION',
  'first-checkin': 'FIRST VISIT',
  'year-report': 'YEAR REPORT',
}

export interface TicketTheme {
  bg: string; ink: string; accent: string; accentDeep: string
  sub: string; label: string; border: string; url: string
}
export const KIND_THEME: Record<MemorialKind, TicketTheme> = {
  'route-complete': { bg: '#F8F0DF', ink: '#3A2C1A', accent: '#E45876', accentDeep: '#962A48', sub: '#7A5C38', label: '#B2986E', border: '#D4C096', url: '#B2986E' },
  'collection-complete': { bg: '#FAF4E0', ink: '#463614', accent: '#D6A028', accentDeep: '#966E14', sub: '#826428', label: '#B49C64', border: '#E0CE96', url: '#B49C64' },
  'first-checkin': { bg: '#EEF5F8', ink: '#1E3A44', accent: '#3E9BC6', accentDeep: '#1E6E8E', sub: '#3E6E7E', label: '#7AAEBE', border: '#B8D6E0', url: '#7AAEBE' },
  'year-report': { bg: '#F4ECF8', ink: '#3A2444', accent: '#9B6AC6', accentDeep: '#6E3E96', sub: '#6E5482', label: '#A88EBE', border: '#D2C2E0', url: '#A88EBE' },
}

export interface MemorialAssets {
  logo: HTMLImageElement
  stamp?: HTMLImageElement
  taku?: HTMLImageElement
  iconMap?: HTMLImageElement
  iconShop?: HTMLImageElement
  iconClock?: HTMLImageElement
}

export type MemorialTemplate = (
  ctx: CanvasRenderingContext2D,
  data: MemorialData,
  assets: MemorialAssets,
) => void

export const MEMORIAL_RATIO = 2 / 3
export const MEMORIAL_W = 1080
export const MEMORIAL_H = 1620
