import { Shop } from '@/types/shop'

export type ShopStatusKind =
  | 'open'
  | 'closing_soon'
  | 'before'
  | 'closed'
  | 'dayoff'
  | 'temp_closed'
  | 'permanently_closed'
  | 'unknown'

export interface ShopStatusResult {
  kind: ShopStatusKind
  label: string
  detail: string
}

const DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const DAY_KO = ['일', '월', '화', '수', '목', '금', '토']
const SOON = 60

const toMin = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
const fmt = (min: number) => {
  const h = Math.floor((min % 1440) / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function getShopStatus(shop: Shop, now: Date = new Date()): ShopStatusResult {
  if (shop.status === 'temporary_closed') return { kind: 'temp_closed', label: '임시 휴무', detail: '' }
  if (shop.status === 'closed') return { kind: 'permanently_closed', label: '폐점', detail: '' }

  const hours = shop.hours
  if (!hours || !DAY.some((d) => hours[d])) return { kind: 'unknown', label: '', detail: '' }

  const dow = now.getDay()
  const nowMin = now.getHours() * 60 + now.getMinutes()

  const y = hours[DAY[(dow + 6) % 7]]
  if (y) {
    const yo = toMin(y.open)
    const yc = toMin(y.close)
    if (yc <= yo && nowMin < yc) {
      const remain = yc - nowMin
      return remain <= SOON
        ? { kind: 'closing_soon', label: '곧 마감', detail: `${fmt(yc)}까지` }
        : { kind: 'open', label: '영업중', detail: `${fmt(yc)}까지` }
    }
  }

  const t = hours[DAY[dow]]
  if (t) {
    const o = toMin(t.open)
    let c = toMin(t.close)
    if (c <= o) c += 1440
    if (nowMin >= o && nowMin < c) {
      const remain = c - nowMin
      return remain <= SOON
        ? { kind: 'closing_soon', label: '곧 마감', detail: `${fmt(c)}까지` }
        : { kind: 'open', label: '영업중', detail: `${fmt(c)}까지` }
    }
    if (nowMin < o) return { kind: 'before', label: '영업 전', detail: `오늘 ${fmt(o)} 오픈` }
  }

  for (let i = 1; i <= 7; i++) {
    const nd = (dow + i) % 7
    const nh = hours[DAY[nd]]
    if (nh) {
      const when = i === 1 ? '내일' : DAY_KO[nd]
      return t
        ? { kind: 'closed', label: '영업 종료', detail: `${when} ${fmt(toMin(nh.open))} 오픈` }
        : { kind: 'dayoff', label: '휴무', detail: `${when} ${fmt(toMin(nh.open))} 오픈` }
    }
  }
  return { kind: 'unknown', label: '', detail: '' }
}
