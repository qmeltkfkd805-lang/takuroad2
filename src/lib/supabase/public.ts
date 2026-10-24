import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/* 공개 정보 전용 서버 클라이언트 (2026-10-24)
   lib/supabase/server.ts 는 로그인 쿠키를 읽는다 → Next.js 가 그 페이지를 '사람마다 다른 페이지'로 보고
   캐시를 아예 안 해서, 열 때마다(봇이 긁을 때마다) 서버 CPU를 썼다 (Vercel Hobby CPU 한도 초과의 원인).
   누가 봐도 같은 공개 정보(샵 상세 등)는 이걸로 읽는다 — 쿠키를 안 읽으니 페이지 캐시(ISR)가 된다.
   ⚠️ 비로그인(anon) 권한으로 읽는다. 로그인한 사람만 볼 수 있는 정보에는 쓰지 말 것. */
export function createPublicClient() {
  return createSupabaseClient(env.supabase.url, env.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
