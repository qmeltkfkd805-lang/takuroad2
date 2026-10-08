import { createClient } from '@/lib/supabase/client'

export interface ActiveWork {
  id: string
  name: string
  slug: string
}

/* ⚡ '지금 뜨는 작품'은 누구에게나 같은 집계라, 서버(/api/works/active)가 10분에 한 번만 DB에서 만들고
   그 사이엔 만들어 둔 걸 모두에게 나눠 준다. (예전엔 화면을 열 때마다 사람마다 DB 함수를 불렀다 —
   이틀에 843번, DB 사용 시간 3위였다)
   화면마다 필요한 개수(5·10·50·200)가 달라서, 서버는 넉넉히 상위 ACTIVE_WORKS_MAX 개를 만들어 두고 앞에서 잘라 쓴다. */
export const ACTIVE_WORKS_MAX = 200
const BROWSER_TTL_MS = 10 * 60 * 1000

// 최근 7일 작품별 활동(검색 고유 사용자 + 최애/관심 등록) 합산 상위 N개.
// DB 함수(get_active_works)로 집계 — 개별 기록은 노출 안 하고 합계만. (DB에서 직접 — 서버·브라우저 둘 다 쓸 수 있음)
export async function loadActiveWorks(limit = 6): Promise<ActiveWork[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('get_active_works', {
    days: 7,
    max_count: limit,
  })
  if (error) {
    console.error('[활발한작품] rpc:', error)
    return []
  }
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, slug: r.slug }))
}

// 브라우저 안에서 한 번 받아 둔 목록 — 같은 화면에서 여러 곳(상단바·샵 전체보기 등)이 불러도 요청은 한 번
let browserCache: { at: number; p: Promise<ActiveWork[] | null> } | null = null

async function fetchCachedList(): Promise<ActiveWork[] | null> {
  try {
    const res = await fetch('/api/works/active')
    if (!res.ok) return null
    const j = await res.json()
    return Array.isArray(j?.items) ? (j.items as ActiveWork[]) : null
  } catch {
    return null
  }
}

/** 화면용 — 브라우저에선 서버가 만들어 둔 목록을 받아 앞에서 limit 개만. 실패하면 예전처럼 DB 직접. 서버에선 DB 직접. */
export async function getActiveWorks(limit = 6): Promise<ActiveWork[]> {
  if (typeof window === 'undefined') return loadActiveWorks(limit)
  if (!browserCache || Date.now() - browserCache.at > BROWSER_TTL_MS) {
    browserCache = { at: Date.now(), p: fetchCachedList() }
  }
  const list = await browserCache.p
  if (list) return list.slice(0, limit)
  browserCache = null   // 실패한 결과는 붙잡아 두지 않는다
  return loadActiveWorks(limit)
}
