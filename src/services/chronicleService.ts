import { createClient } from '@/lib/supabase/client'

export interface ChronicleEvent {
  id: string
  type: string
  title: string
  link: string | null
  created_at: string
  isMilestone: boolean
}

export interface ChronicleMonth {
  yearMonth: string
  events: ChronicleEvent[]
}

// 전체 연대기 (월별 그룹핑 + 첫 발생 마일스톤 표시)
export async function getMyChronicle(userId: string): Promise<ChronicleMonth[]> {
  const supabase = createClient()

  const { data } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (!data || data.length === 0) return []

  // type별 최초 발생 시점 찾기
  const firstOccurrence = new Map<string, string>()
  for (const log of data) {
    if (!firstOccurrence.has(log.type)) {
      firstOccurrence.set(log.type, log.id)
    }
  }

  // 월별 그룹핑 (최신순으로 보여주기 위해 reverse)
  const grouped = new Map<string, ChronicleEvent[]>()
  for (const log of data) {
    const yearMonth = log.created_at.slice(0, 7) // "2026-08"
    if (!grouped.has(yearMonth)) grouped.set(yearMonth, [])
    grouped.get(yearMonth)!.push({
      id: log.id,
      type: log.type,
      title: log.title,
      link: log.link,
      created_at: log.created_at,
      isMilestone: firstOccurrence.get(log.type) === log.id,
    })
  }

  return Array.from(grouped.entries())
    .map(([yearMonth, events]) => ({
      yearMonth,
      events: events.reverse(), // 월 안에서는 최신순
    }))
    .reverse() // 월 자체도 최신순
}

// 오늘의 추억 (N년 전 오늘)
export async function getMemoriesOnThisDay(userId: string) {
  const supabase = createClient()
  const today = new Date()
  const results: { yearsAgo: number; events: ChronicleEvent[] }[] = []

  for (let yearsAgo = 1; yearsAgo <= 5; yearsAgo++) {
    const targetDate = new Date(today)
    targetDate.setFullYear(today.getFullYear() - yearsAgo)
    const dateStr = targetDate.toISOString().slice(0, 10)

    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', `${dateStr}T00:00:00`)
      .lt('created_at', `${dateStr}T23:59:59`)

    if (data && data.length > 0) {
      results.push({
        yearsAgo,
        events: data.map(log => ({
          id: log.id,
          type: log.type,
          title: log.title,
          link: log.link,
          created_at: log.created_at,
          isMilestone: false,
        })),
      })
    }
  }

  return results
}