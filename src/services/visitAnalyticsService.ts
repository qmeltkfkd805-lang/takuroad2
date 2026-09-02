import { createClient } from '@/lib/supabase/client'

/* 방문 경로 분석 (관리자 전용).
   migrations/visit_analytics.sql의 읽기 전용 RPC들을 감싼다.
   저장하는 건 없다 — visit_logs에 이미 쌓인 데이터를 집계만 한다. */

export interface TopPathRow { path: string; pv: number; uv: number }
export interface ReferrerRow { source: string; sessions: number; landingPath: string | null }
export interface ExitPathRow { path: string; exits: number; bounces: number }
export interface VisitSessionRow {
  sessionId: string
  userId: string | null
  nickname: string | null
  startedAt: string
  endedAt: string
  pageCount: number
  entryPath: string | null
  exitPath: string | null
}
export interface SessionStep { path: string; at: string }

/* RPC 응답은 Database 타입이 any라 형태가 안 잡힌다. 여기서 필요한 필드만 명시한다. */
type PgErrorLike = { message?: string; code?: string; details?: string; hint?: string }
/** 숫자 컬럼이 bigint면 문자열로 오기도 해서 둘 다 받는다 */
type Num = number | string | null | undefined
type RawRow = Record<string, Num>

/** RPC 실패를 한 곳에서 로그로 남긴다. PostgrestError는 그냥 찍으면 {}로 나온다 */
function logRpcError(tag: string, error: unknown) {
  const e = (error ?? {}) as PgErrorLike
  console.error(`[방문 분석] ${tag} rpc 실패:`, {
    message: e.message, code: e.code, details: e.details, hint: e.hint,
  })
}

const str = (v: Num): string | null => (v == null ? null : String(v))
const num = (v: Num): number => Number(v) || 0

/** 페이지별 순위. grouped=true면 /event/:id 로 묶어서, false면 실제 주소 그대로 */
export async function getTopPaths(days = 30, grouped = true, limit = 30): Promise<TopPathRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_top_paths', { days, grouped, limit_n: limit })
  if (error) { logRpcError('페이지 순위', error); return [] }
  return ((data ?? []) as RawRow[]).map(r => ({
    path: str(r.path) ?? '/', pv: num(r.pv), uv: num(r.uv),
  }))
}

/** 유입 경로 — 세션의 첫 페이지 기준이라 값은 "방문(세션) 수"다 */
export async function getVisitReferrers(days = 30, limit = 20): Promise<ReferrerRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_visit_referrers', { days, limit_n: limit })
  if (error) { logRpcError('유입 경로', error); return [] }
  return ((data ?? []) as RawRow[]).map(r => ({
    source: str(r.source) ?? '알 수 없음',
    sessions: num(r.sessions),
    landingPath: str(r.landing_path),
  }))
}

/** 이탈 페이지 — 세션의 마지막 페이지. bounces는 그 페이지 하나만 보고 나간 세션 수 */
export async function getExitPaths(days = 30, limit = 30): Promise<ExitPathRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_exit_paths', { days, limit_n: limit })
  if (error) { logRpcError('이탈 페이지', error); return [] }
  return ((data ?? []) as RawRow[]).map(r => ({
    path: str(r.path) ?? '/', exits: num(r.exits), bounces: num(r.bounces),
  }))
}

/** 최근 세션 목록 (최근 것부터) */
export async function getRecentVisitSessions(days = 7, limit = 50): Promise<VisitSessionRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_recent_visit_sessions', { days, limit_n: limit })
  if (error) { logRpcError('세션 목록', error); return [] }
  return ((data ?? []) as RawRow[]).map(r => ({
    sessionId: str(r.session_id) ?? '',
    userId: str(r.user_id),
    nickname: str(r.nickname),
    startedAt: str(r.started_at) ?? '',
    endedAt: str(r.ended_at) ?? '',
    pageCount: num(r.page_count),
    entryPath: str(r.entry_path),
    exitPath: str(r.exit_path),
  }))
}

/** 한 세션이 돌아본 순서 */
export async function getVisitSessionPath(sessionId: string): Promise<SessionStep[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_visit_session_path', { p_session_id: sessionId })
  if (error) { logRpcError('세션 경로', error); return [] }
  return ((data ?? []) as RawRow[]).map(r => ({ path: str(r.path) ?? '/', at: str(r.created_at) ?? '' }))
}
