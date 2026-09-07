import { createClient } from '@/lib/supabase/client'

/** 정보 확인이 밀린 샵 (getAdminTodoSummary.staleShops) */
export interface StaleShop {
  id: string
  name: string
  slug: string
  visit_count: number | null
  info_last_confirmed_at: string | null
}

export interface AdminTodoSummary {
  /** 미처리 신고가 있는 샵 수 (신고 건수가 아니다 — ReportedShopsTab 목록 행 수와 같다) */
  pendingSuggestions: number
  pendingVerifyRequests: number
  staleShops: StaleShop[]
  unconfirmedProducts: number
}

export async function getAdminTodoSummary(): Promise<AdminTodoSummary> {
  const supabase = createClient()
  /* 사이드바 '샵 신고' 배지용. ReportedShopsTab 이 shop_id 로 묶어서 보여주므로
     여기서도 신고 건수가 아니라 신고된 샵 수를 센다 — 안 그러면 배지 2인데
     목록에는 1줄만 있는 상황이 된다(실제로 그랬다).
     count exact 로는 distinct 를 못 세므로 shop_id 만 받아 JS 에서 묶는다. */
  const { data: suggestionRows } = await supabase
    .from('shop_suggestions').select('shop_id').eq('status', 'pending')
  const pendingSuggestions = new Set((suggestionRows ?? []).map(r => r.shop_id)).size

  const { count: pendingVerifyRequests } = await supabase.from('shop_verify_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 180)
  const { data: staleShops } = await supabase.from('shops').select('id, name, slug, visit_count, info_last_confirmed_at').lt('info_last_confirmed_at', cutoff.toISOString()).eq('status', 'active').order('visit_count', { ascending: false }).limit(5)
  const { count: unconfirmedProducts } = await supabase.from('shop_products').select('id', { count: 'exact', head: true }).eq('confirm_count', 0).eq('is_active', true)
  return {
    pendingSuggestions,
    pendingVerifyRequests: pendingVerifyRequests ?? 0,
    staleShops: (staleShops ?? []) as StaleShop[],
    unconfirmedProducts: unconfirmedProducts ?? 0,
  }
}

export interface AdminStats {
  works: number; shops: number; events: number; banners: number; members: number; favorites: number; newMembersToday: number
  shopsTotal: number; shopsActive: number; shopsTemp: number; shopsClosed: number; shopsOfficial: number
}

export async function getAdminStats(): Promise<AdminStats> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_dashboard_stats')
  const zero: AdminStats = { works: 0, shops: 0, events: 0, banners: 0, members: 0, favorites: 0, newMembersToday: 0, shopsTotal: 0, shopsActive: 0, shopsTemp: 0, shopsClosed: 0, shopsOfficial: 0 }
  if (error || !data) { console.error('[대시보드 통계] rpc:', error); return zero }
  const d = data as any
  return {
    works: d.works ?? 0,
    shops: d.shops ?? 0,
    events: d.events ?? 0,
    banners: d.banners ?? 0,
    members: d.members ?? 0,
    favorites: d.favorites ?? 0,
    newMembersToday: d.new_members_today ?? 0,
    shopsTotal: d.shops_total ?? 0,
    shopsActive: d.shops_active ?? 0,
    shopsTemp: d.shops_temp ?? 0,
    shopsClosed: d.shops_closed ?? 0,
    shopsOfficial: d.shops_official ?? 0,
  }
}

/* ── 사이드바 배지 · '처리해야 할 업무'용 미처리 건수 ───────────────────────────
   읽기 전용 count만 가져온다(head: true라 본문은 안 받는다). 기존 테이블·컬럼만 쓰고
   마이그레이션·RPC·정책은 건드리지 않는다.

   ⭐ 배지는 "그 화면에 들어가면 보게 될 항목 수"다. 신고 건수가 아니다.
      신고 화면들은 대상(글·샵) 단위로 묶어서 보여주므로, 건수로 세면
      배지 5인데 목록에는 2줄만 있는 상황이 된다. 실제로 그랬다(샵 신고 2건 / 1샵).
      count exact 로는 distinct 를 못 세므로 대상 id 만 받아 JS 에서 묶는다.
      대기열은 크지 않아 부담이 없다.
      건수는 각 화면 상단 요약 카드와 항목별 "미처리 N건" 배지에 이미 나온다.

   "미처리" 기준은 기존 관리 화면에서 그대로 가져왔다:
   - 게시글 신고 : post_reports.status='pending' 인 글 수 (distinct post_id).
                   PostReportsTab 의 미처리 탭·목록과 같은 단위다.
                   예전에는 처리 상태 컬럼이 없어 "숨김 처리된 글" 수를 대신 셌는데,
                   그건 신고 대기열이 아니라 조치 결과라 배지 숫자가 실제 할 일과 달랐다
                   (자동 숨김 글이 쌓이면 배지가 늘고, 반려해도 줄지 않았다).
   - 문의/제휴  : ContactAdminTab의 STATUS_LABEL = pending·processing·done.
                   updateContactMessage가 완료 시 'done'으로 바꾼다 → done이 아니면 미처리.
                   문의 관리는 type≠'partner', 제휴 문의는 type='partner' (탭 필터와 동일).
   ※ 샵 신고 배지는 여기서 조회하지 않는다. getAdminTodoSummary의 pendingSuggestions
     를 쓴다 — 거기서도 같은 이유로 distinct shop_id 를 센다.

   실패한 항목만 null이 되고 나머지는 살아남는다(대시보드 전체가 깨지지 않게). */
const CONTACT_STATUS_DONE = 'done'      // ContactAdminTab / updateContactMessage
const CONTACT_TYPE_PARTNER = 'partner'  // AdminPage의 onlyType/excludeType
const POST_REPORT_PENDING = 'pending'   // post_reports.status — migrations/post_report_review.sql
const SHOP_REVIEW_PENDING = 'pending'   // shops.review_status — migrations/shop_review.sql

/** null = 조회 실패 또는 아직 안 옴 (UI에서 '—' 처리) */
export interface AdminBadgeCounts {
  /** 미처리 신고가 있는 게시글 수 (신고 건수가 아니다 — PostReportsTab 목록 행 수와 같다) */
  pendingPostReports: number | null
  openContacts: number | null
  openPartners: number | null
  /** 신규 샵 검수 대기 (review_status='pending'). 기능 도입 전 샵은 NULL이라 안 잡힌다 */
  shopReview: number | null
}

// supabase count 응답에서 필요한 부분만 좁게 본다 (Database 타입이 any라 여기서 형태를 명시한다)
type CountResult = { count: number | null; error: { message?: string; code?: string; details?: string; hint?: string } | null }

export async function getAdminBadgeCounts(): Promise<AdminBadgeCounts> {
  const supabase = createClient()

  /* 게시글 신고만 셈법이 다르다 — 건수가 아니라 신고된 글 수다.
     count exact 로는 distinct 를 못 세므로 post_id 만 받아 JS 에서 묶는다. */
  let pendingPostReports: number | null = null
  try {
    const { data, error } = await supabase
      .from('post_reports').select('post_id').eq('status', POST_REPORT_PENDING)
    if (error) throw error
    pendingPostReports = new Set((data ?? []).map(r => r.post_id)).size
  } catch (e) {
    console.error('[관리자 배지] 미처리 게시글 신고 조회 실패:', e)
  }

  const results = await Promise.allSettled<CountResult>([
    supabase.from('contact_messages').select('id', { count: 'exact', head: true })
      .neq('status', CONTACT_STATUS_DONE).neq('type', CONTACT_TYPE_PARTNER),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true })
      .neq('status', CONTACT_STATUS_DONE).eq('type', CONTACT_TYPE_PARTNER),
    supabase.from('shops').select('id', { count: 'exact', head: true })
      .eq('review_status', SHOP_REVIEW_PENDING),
  ])

  const pick = (r: PromiseSettledResult<CountResult>, tag: string): number | null => {
    if (r.status !== 'fulfilled') { console.error(`[관리자 배지] ${tag} 조회 실패:`, r.reason); return null }
    const e = r.value?.error
    if (e) {
      console.error(`[관리자 배지] ${tag} 조회 실패:`, { message: e.message, code: e.code, details: e.details, hint: e.hint })
      return null
    }
    return r.value?.count ?? 0
  }

  return {
    pendingPostReports,
    openContacts: pick(results[0], '문의'),
    openPartners: pick(results[1], '제휴 문의'),
    shopReview: pick(results[2], '신규 샵 검수'),
  }
}

export interface TopShop { id: string; name: string; slug: string; visit_count: number }

export async function getTopShops(limit = 5): Promise<TopShop[]> {
  const supabase = createClient()
  const { data } = await supabase.from('shops').select('id, name, slug, visit_count').eq('status', 'active').order('visit_count', { ascending: false }).limit(limit)
  return (data ?? []) as TopShop[]
}
