import { createClient } from '@supabase/supabase-js'

/** 서버 전용 Service Role 클라이언트. 절대 클라이언트 번들에서 import 하지 말 것. */
export function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
