import { BusinessHours } from '@/types/database'
import { WEEKDAYS, WEEKDAY_LABEL } from '@/lib/constants/categories'

const DAY_INDEX: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return (h || 0) * 60 + (m || 0) }

/** 종료 시각 표시용: 자정 넘김(00:00)을 보기 좋게 24:00으로. */
function displayClose(open: string, close: string) {
  if (close === '24:00') return '24:00'
  if (close === '00:00' && toMin(close) <= toMin(open)) return '24:00'
  return close
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
  const openMin = toMin(open)
  // 종료가 시작보다 같거나 이르면 자정을 넘긴 것으로 본다.
  // (예: 09:00~24:00을 오전 12시=00:00로 저장했거나, 18:00~02:00 심야영업)
  const overnight = toMin(close) <= openMin
  const closeMin = overnight ? toMin(close) + 1440 : toMin(close)
  const nowAdj = overnight && now < openMin ? now + 1440 : now

  // 휴게시간 (있는 매장만)
  const hasBreak = !!(todayData.breakStart && todayData.breakEnd)
  const breakStartMin = hasBreak ? toMin(todayData.breakStart!) : null
  const breakEndMin = hasBreak ? toMin(todayData.breakEnd!) : null
  const inBreak = hasBreak && nowAdj >= breakStartMin! && nowAdj < breakEndMin!

  const isOpen = nowAdj >= openMin && nowAdj < closeMin && !inBreak
  const closeLabel = displayClose(open, close)
  const todayHours = hasBreak
    ? `${open} ~ ${todayData.breakStart}, ${todayData.breakEnd} ~ ${closeLabel}`
    : `${open} ~ ${closeLabel}`

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
            ? `${data.open} ~ ${data.breakStart}, ${data.breakEnd} ~ ${displayClose(data.open, data.close)}`
            : `${data.open} ~ ${displayClose(data.open, data.close)}`,
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
