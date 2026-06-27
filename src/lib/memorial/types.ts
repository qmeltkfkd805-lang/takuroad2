export type MemorialKind =
  | 'route'
  | 'collection'
  | 'checkin'
  | 'event'
  | 'anniversary'
  | 'year-report'

export type CollectionType = 'pilgrimage' | 'goods' | 'cafe' | 'region'
export type RouteType = 'goods-shop-tour' | 'popup-tour' | 'cafe-tour' | 'mixed-tour'

export interface MemorialData {
  kind: MemorialKind
  title: string
  subtitle?: string
  rallyNo: string
  date?: string
  collectionType?: CollectionType
  routeType?: RouteType
  shopCount?: number
  walkTime?: number
  area?: string
}

export interface Ink { main: string; deep: string }
export const KIND_INK: Record<MemorialKind, Ink> = {
  route:        { main: '#DC4656', deep: '#A8303E' },
  collection:   { main: '#B28734', deep: '#866226' },
  checkin:      { main: '#4678A8', deep: '#33597E' },
  event:        { main: '#369682', deep: '#266E5E' },
  anniversary:  { main: '#965078', deep: '#6E3E5A' },
  'year-report':{ main: '#7A6AAE', deep: '#564A82' },
}

export type PaperKind = 'ticket' | 'stampbook' | 'receipt' | 'postcard'
export const KIND_PAPER: Record<MemorialKind, PaperKind> = {
  route: 'ticket',
  collection: 'stampbook',
  checkin: 'receipt',
  event: 'ticket',
  anniversary: 'postcard',
  'year-report': 'postcard',
}

const COLLECTION_STAMP: Record<CollectionType, string> = {
  pilgrimage: 'pilgrimage',
  goods: 'exhibition',
  cafe: 'cafe',
  region: 'pilgrimage',
}
export function resolveStamp(data: MemorialData): string {
  if (data.kind === 'route') return 'route'
  if (data.kind === 'collection' && data.collectionType) return COLLECTION_STAMP[data.collectionType]
  return 'default'
}

export const ROUTE_TYPE_LABEL: Record<RouteType, string> = {
  'goods-shop-tour': '굿즈샵 투어',
  'popup-tour': '팝업 투어',
  'cafe-tour': '콜라보 카페',
  'mixed-tour': '복합 투어',
}
export const ROUTE_TYPE_CATEGORY: Record<RouteType, string> = {
  'goods-shop-tour': '굿즈샵',
  'popup-tour': '팝업스토어',
  'cafe-tour': '콜라보 카페',
  'mixed-tour': '여행지',
}

export const KIND_TICKET_LABEL: Record<MemorialKind, string> = {
  route: 'ROUTE',
  collection: 'COLLECTION',
  checkin: 'CHECK-IN',
  event: 'EVENT',
  anniversary: 'ANNIVERSARY',
  'year-report': 'YEAR REPORT',
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


