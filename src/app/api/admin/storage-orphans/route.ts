import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* ============================================================
   Storage 삭제 후보 조회 — 관리자 전용, 읽기 전용

   삭제 기능은 없다. 이 라우트는 숫자만 돌려준다.
   실제 삭제는 사람이 대시보드에서 확인하고 한다.
   (조사 중 goods_item_images 를 참조 목록에서 빠뜨려 굿즈 사진 6장을
    지울 뻔했다. 자동 삭제가 붙어 있었다면 그냥 사라졌을 것이다)

   0건과 검사 불완전은 다른 상태다
     storage_deletion_candidates() 는 참조 값 중 대조 불가(ambiguous)가
     하나라도 있으면 candidates 를 null 로 내린다. 그 상태를 그대로 전달하고
     complete: false 로 표시한다. 화면에서 "0건" 으로 뭉개면 안 된다.

   증빙은 경로를 내보내지 않는다
     verify-documents 버킷은 SQL 함수가 sample 을 비워서 보내고,
     여기서 한 번 더 지운다. 서버 로그에도 경로를 남기지 않는다 —
     에러 로그는 code 와 message 만 찍는다.
   ============================================================ */

interface RpcBucket {
  bucket: string
  total: number
  total_bytes: number
  candidates: number | null
  candidate_bytes: number | null
  recent_held: number
  recent_held_bytes: number
  paths_suppressed: boolean
  sample: { path: string; bytes: number; created_at: string }[] | null
}

interface RpcReport {
  generated_at: string
  recent_hours: number
  checked_sources: number
  complete: boolean
  ambiguous_count: number
  ambiguous_sources: { src: string; count: number }[]
  status_counts: Record<string, number>
  buckets: RpcBucket[]
}

export async function GET(req: NextRequest) {
  // 1) 관리자 확인 — 서버에서. 화면의 판단을 믿지 않는다
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })

  const { data: profile } = await userSupabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: '권한이 없어요' }, { status: 403 })
  }

  /* 2) 판정 보류 기준 시간. 업로드 직후 아직 DB 에 연결되지 않은 객체가 있어서
        최근 생성분은 후보에서 빼고 따로 센다. 기본 24시간. */
  const rawHours = req.nextUrl.searchParams.get('hours')
  let hours = 24
  if (rawHours !== null) {
    const n = Number(rawHours)
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'hours 는 0 이상의 숫자여야 해요' }, { status: 400 })
    }
    hours = Math.min(Math.floor(n), 24 * 90)
  }

  const svc = serviceClient()
  const { data, error } = await svc.rpc('storage_deletion_candidates', {
    p_recent_hours: hours,
    p_sample_limit: 20,
  })

  if (error) {
    // 조회 실패를 "0건" 으로 바꾸지 않는다. 경로는 로그에도 남기지 않는다.
    console.error('[storage-orphans] 조회 실패', error.code, error.message)
    return NextResponse.json(
      { error: '삭제 후보를 조회하지 못했어요', complete: false },
      { status: 500 },
    )
  }

  const report = data as RpcReport | null
  if (!report) {
    return NextResponse.json(
      { error: '보고서가 비어 있어요', complete: false },
      { status: 500 },
    )
  }

  const complete = report.complete === true

  const buckets = (report.buckets ?? []).map(b => ({
    bucket: b.bucket,
    objects: b.total,
    bytes: b.total_bytes,
    // complete 가 아니면 null 이 그대로 내려간다. 화면에서 숫자로 바꾸지 말 것
    candidates: complete ? b.candidates : null,
    candidateBytes: complete ? b.candidate_bytes : null,
    // 최근 업로드라 판정을 보류한 객체
    heldRecent: b.recent_held,
    heldRecentBytes: b.recent_held_bytes,
    pathsSuppressed: b.paths_suppressed === true,
    // 증빙 버킷은 SQL 에서 이미 비워서 오지만 여기서 한 번 더 지운다
    sample: b.paths_suppressed ? [] : (complete ? (b.sample ?? []) : null),
  }))

  const sum = (pick: (b: typeof buckets[number]) => number | null) =>
    buckets.reduce((acc, b) => {
      const v = pick(b)
      return acc === null || v === null ? null : acc + v
    }, 0 as number | null)

  return NextResponse.json({
    ok: true,
    generatedAt: report.generated_at,
    recentHours: report.recent_hours,

    /* 검사 완전성. false 면 candidates 가 전부 null 이고,
       화면은 "0건" 이 아니라 "검사 불완전" 을 보여야 한다. */
    complete,
    ambiguousCount: report.ambiguous_count ?? 0,
    ambiguousSources: report.ambiguous_sources ?? [],

    /* 값이 하나라도 있는 참조 출처 수. 정의돼 있지만 전부 NULL 인 컬럼은
       세지 않으므로 "검사한 출처 수" 와 같지 않다. 정의 목록은
       storage_reference_values 뷰에 있다. */
    sourcesWithValues: report.checked_sources ?? 0,
    statusCounts: report.status_counts ?? {},

    totals: {
      objects: buckets.reduce((a, b) => a + b.objects, 0),
      bytes: buckets.reduce((a, b) => a + b.bytes, 0),
      candidates: sum(b => b.candidates),
      candidateBytes: sum(b => b.candidateBytes),
      heldRecent: buckets.reduce((a, b) => a + b.heldRecent, 0),
      heldRecentBytes: buckets.reduce((a, b) => a + b.heldRecentBytes, 0),
    },

    buckets,
  })
}
