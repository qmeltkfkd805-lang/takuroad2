import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/types/database'
import { env } from '@/lib/env'

/* ── 같은 조회 한 번만 (2026-10-15) ──
   한 화면에서 여러 부품이 같은 걸 따로 물어봐서(내 저장 샵·레벨·관심 작품 등) 같은 요청이 4~6번씩 나가고 있었다.
   - 똑같은 조회(GET·HEAD, 같은 주소·같은 로그인)가 동시에 또는 3초 안에 다시 오면 처음 응답을 나눠 쓴다.
   - 무언가를 바꾸는 요청(글쓰기·좋아요·저장 등)이 나가면 기억해 둔 걸 전부 버린다 → 바꾼 뒤엔 항상 새로 받는다.
   - 조회 전용 함수(get_·my_·is_ 로 시작하는 rpc)는 바꾸는 요청으로 치지 않는다. */
const TTL = 3000
const memo = new Map<string, { at: number; res: Promise<Response> }>()
const READ_RPC = /\/rest\/v1\/rpc\/(get_|my_|is_|count_|list_|search_)/i

function dedupedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase()
  if (!url.includes('/rest/v1/')) return fetch(input, init)
  if (method !== 'GET' && method !== 'HEAD') {
    if (!READ_RPC.test(url)) memo.clear()
    return fetch(input, init)
  }
  if (init?.signal) return fetch(input, init)   // 중간에 취소할 수 있는 요청은 나눠 쓰지 않는다
  const h = new Headers(init?.headers)
  const key = [method, url, h.get('authorization'), h.get('accept'), h.get('prefer'), h.get('range'), h.get('accept-profile')].join('|')
  const now = Date.now()
  const hit = memo.get(key)
  if (hit && now - hit.at < TTL) return hit.res.then(r => r.clone())
  const res = fetch(input, init)
  const entry = { at: now, res }
  memo.set(key, entry)
  res.then(r => { if (!r.ok && memo.get(key) === entry) memo.delete(key) }, () => { if (memo.get(key) === entry) memo.delete(key) })
  setTimeout(() => { if (memo.get(key) === entry) memo.delete(key) }, TTL + 50)
  return res.then(r => r.clone())
}

export function createClient() {
  return createBrowserClient<Database>(
    env.supabase.url,
    env.supabase.anonKey,
    { global: { fetch: dedupedFetch } }
  )
}
