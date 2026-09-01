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



