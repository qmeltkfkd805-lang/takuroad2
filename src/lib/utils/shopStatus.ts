import { Shop } from '@/types/shop'
import { isMonthlyOffDate } from './monthlyOff'
import { holidayName } from './krHolidays'
import { hoursForDate } from './date'

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

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const y = hoursForDate(hours, yesterday)
  if (y) {
    const yo = toMin(y.open)
    const yc = toMin(y.close)
    if (yc <= yo && nowMin < yc) {
      const remain = yc - nowMin
      const ylo = y.lastOrder ? toMin(y.lastOrder) : null
      if (ylo !== null && ylo < yo && nowMin >= ylo) return { kind: 'closing_soon', label: '주문 마감', detail: `${fmt(yc)}까지` }
      return remain <= SOON
        ? { kind: 'closing_soon', label: '곧 마감', detail: `${fmt(yc)}까지` }
        : { kind: 'open', label: '영업중', detail: `${fmt(yc)}까지` }
    }
  }

  // 오늘이 매달 정기휴무(예: 둘째·넷째 일요일)거나 공휴일 휴무면 오늘 영업시간은 없다.
  // 공휴일에 시간이 다른 매장은 그 시간을 쓴다 (hoursForDate)
  const offToday = isMonthlyOffDate(hours, now)
  const t = hoursForDate(hours, now)
  const holidayOff = !offToday && t === null && !!holidayName(now) && !!hours[DAY[dow]]
  if (t) {
    const o = toMin(t.open)
    let c = toMin(t.close)
    if (c <= o) c += 1440
    if (nowMin >= o && nowMin < c) {
      const remain = c - nowMin
      // 라스트 오더가 지났으면 "주문 마감"
      let lo = t.lastOrder ? toMin(t.lastOrder) : null
      if (lo !== null && lo < o) lo += 1440
      if (lo !== null && nowMin >= lo) return { kind: 'closing_soon', label: '주문 마감', detail: `${fmt(c)}까지` }
      return remain <= SOON
        ? { kind: 'closing_soon', label: '곧 마감', detail: `${fmt(c)}까지` }
        : { kind: 'open', label: '영업중', detail: `${fmt(c)}까지` }
    }
    if (nowMin < o) return { kind: 'before', label: '영업 전', detail: `오늘 ${fmt(o)} 오픈` }
  }

  // 다음 오픈일 — 정기휴무 날은 건너뛴다(한 주 전체가 걸릴 수 있어 최대 14일 탐색)
  for (let i = 1; i <= 14; i++) {
    const nd = (dow + i) % 7
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)
    const nh = hoursForDate(hours, day)
    if (nh) {
      const when = i === 1 ? '내일' : i < 7 ? DAY_KO[nd] : `${day.getMonth() + 1}/${day.getDate()}(${DAY_KO[nd]})`
      return t
        ? { kind: 'closed', label: '영업 종료', detail: `${when} ${fmt(toMin(nh.open))} 오픈` }
        : { kind: 'dayoff', label: offToday ? '정기휴무' : holidayOff ? '공휴일 휴무' : '휴무', detail: `${when} ${fmt(toMin(nh.open))} 오픈` }
    }
  }
  return { kind: 'unknown', label: '', detail: '' }
}
