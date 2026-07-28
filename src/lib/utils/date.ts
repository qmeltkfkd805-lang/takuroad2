import { BusinessHours } from '@/types/database'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'

const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

/**
 * 오늘 영업 상태 반환
 */
export function getTodayStatus(hours: BusinessHours | null): {
  isOpen: boolean
  label: string
  todayHours: string | null
} {
  if (!hours) return { isOpen: false, label: '영업시간 정보 없음', todayHours: null }

  const today = new Date()
  const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
  const todayKey = dayNames[today.getDay()] as keyof BusinessHours

  const todayData = hours[todayKey]

  // 키 자체가 없으면 정보 없음
  if (todayData === undefined) {
    return { isOpen: false, label: '영업시간 정보 없음', todayHours: null }
  }

  // null이면 휴무
  if (todayData === null) {
    return { isOpen: false, label: '오늘 휴무', todayHours: null }
  }

  const { open, close } = todayData
  const now = today.getHours() * 60 + today.getMinutes()
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const openMin = toMin(open)
  const closeMin = toMin(close)

  // 휴게시간 (있는 매장만)
  const hasBreak = !!(todayData.breakStart && todayData.breakEnd)
  const breakStartMin = hasBreak ? toMin(todayData.breakStart!) : null
  const breakEndMin = hasBreak ? toMin(todayData.breakEnd!) : null
  const inBreak = hasBreak && now >= breakStartMin! && now < breakEndMin!

  const isOpen = now >= openMin && now < closeMin && !inBreak
  const todayHours = hasBreak
    ? `${open} ~ ${todayData.breakStart}, ${todayData.breakEnd} ~ ${close}`
    : `${open} ~ ${close}`

  return {
    isOpen,
    label: inBreak ? '휴게시간' : isOpen ? '영업중' : '영업 종료',
    todayHours,
  }
}

/**
 * 영업시간 전체 포맷
 * { mon: {open:'10:00', close:'20:00'}, wed: null } → 표시용 배열
 */
export function formatBusinessHours(hours: BusinessHours | null) {
  if (!hours) return []

  return WEEKDAYS.map(day => {
    const data = hours[day]
    return {
      day,
      label: WEEKDAY_LABEL[day],
      hours: data === undefined
        ? '정보 없음'
        : data === null
          ? '휴무'
          : data.breakStart && data.breakEnd
            ? `${data.open} ~ ${data.breakStart}, ${data.breakEnd} ~ ${data.close}`
            : `${data.open} ~ ${data.close}`,
      isOpen: data !== null && data !== undefined,
    }
  })
}

/**
 * 팝업 상태 계산
 */
export function getPopupStatus(startDate: string | null, endDate: string | null): {
  status: 'upcoming' | 'ongoing' | 'ended' | null
  label: string
  emoji: string
} {
  if (!startDate && !endDate) return { status: null, label: '', emoji: '' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  if (start && today < start) return { status: 'upcoming', label: '예정', emoji: '🟡' }
  if (end && today > end)     return { status: 'ended',    label: '종료', emoji: '⚫' }
  return { status: 'ongoing', label: '진행중', emoji: '🟢' }
}
