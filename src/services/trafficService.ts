import { createClient } from '@/lib/supabase/client'
import { getOrCreateAnonymousId } from '@/lib/utils/anonymousId'

export type Metric = 'visits' | 'signups' | 'checkins' | 'searches' | 'activity'
export interface TimePoint { date: string; count: number }
export interface VisitSummary { today_pv: number; today_uv: number; yesterday_uv: number; top_path: string | null }

// 봇 UA — 검색 크롤러 등은 방문자 통계에서 제외
const BOT_UA = /bot|crawl|spider|slurp|yeti|bingpreview|facebookexternalhit|mediapartners|headless/i

export async function logVisit(path: string, userId: string | null): Promise<void> {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    if (BOT_UA.test(ua)) return   // 봇은 기록하지 않음
    if (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return  // 로컬 개발 방문 제외
    const supabase = createClient()
    await supabase.from('visit_logs').insert({
      user_id: userId,
      session_id: getOrCreateAnonymousId(),
      path,
      referrer: typeof document !== 'undefined' ? (document.referrer || null) : null,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 300) : null,
    } as any)
  } catch { /* 방문 로그 실패는 조용히 무시 */ }
}

export async function getTimeseries(metric: Metric, days: number): Promise<TimePoint[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_timeseries', { metric, days })
  if (error || !data) { console.error('[시계열] rpc:', error); return [] }
  return data as TimePoint[]
}

/* 유입 채널별 가입 수 (관리자 전용 RPC). profiles.signup_channel 집계 — firstTouch.ts가 채운 값 */
export interface SignupSourceRow { channel: string; count: number }
export async function getSignupSources(days: number): Promise<SignupSourceRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_signup_sources', { days })
  if (error) {
    console.error('[유입 채널] rpc 실패:', {
      message: (error as any)?.message, code: (error as any)?.code,
      details: (error as any)?.details, hint: (error as any)?.hint,
    })
    return []
  }
  return ((data ?? []) as any[]).map(r => ({ channel: r.channel, count: Number(r.count) || 0 }))
}

export async function getVisitSummary(): Promise<VisitSummary | null> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_visit_summary')
  if (error || !data) { console.error('[방문 요약] rpc:', error); return null }
  return data as VisitSummary
}

/* 관리자 대시보드 '오늘' 카드용.
   새 RPC를 만들지 않고 이미 있는 get_visit_summary + get_timeseries를 합쳐 오늘치만 뽑는다.
   그래서 바로 위 트래픽 차트와 항상 같은 값이 나온다. */
export interface TodayCounts {
  visitors: number
  pageviews: number
  checkins: number
  /** 전일 대비 증감. 어제 값을 못 구하면 null (UI에서 증감을 감춘다) */
  visitorsDelta: number | null
  checkinsDelta: number | null
  signupsYesterday: number | null
}

/** 시계열에서 특정 날짜 한 점만 꺼낸다. 그 날 값이 0이면 행 자체가 없으므로 null */
function dayOf(series: TimePoint[], date: string): number | null {
  const row = series.find(p => (p.date ?? '').slice(0, 10) === date)
  return row ? (Number(row.count) || 0) : null
}

const ymd = (offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString('sv-SE')   // 로컬(KST) 기준 YYYY-MM-DD
}

export async function getTodayCounts(): Promise<TodayCounts> {
  const [summary, checkinSeries, signupSeries] = await Promise.all([
    getVisitSummary().catch(() => null),
    getTimeseries('checkins', 7).catch(() => [] as TimePoint[]),
    getTimeseries('signups', 7).catch(() => [] as TimePoint[]),
  ])
  const today = ymd(0)
  const yesterday = ymd(-1)

  const checkinsToday = dayOf(checkinSeries, today) ?? 0
  const checkinsYest = dayOf(checkinSeries, yesterday)

  return {
    visitors: summary?.today_uv ?? 0,
    pageviews: summary?.today_pv ?? 0,
    checkins: checkinsToday,
    // get_visit_summary가 어제 UV를 같이 주므로 그대로 쓴다
    visitorsDelta: summary ? (summary.today_uv ?? 0) - (summary.yesterday_uv ?? 0) : null,
    // 어제 행이 아예 없으면 0건이었다는 뜻이라 0으로 본다 (시계열이 통째로 비면 null)
    checkinsDelta: checkinSeries.length ? checkinsToday - (checkinsYest ?? 0) : null,
    signupsYesterday: signupSeries.length ? (dayOf(signupSeries, yesterday) ?? 0) : null,
  }
}



