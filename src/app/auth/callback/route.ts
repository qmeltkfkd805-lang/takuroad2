import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // profiles 테이블에 없으면 닉네임 설정 페이지로
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nickname')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!profile) {
        // 신규 유저 → 닉네임 설정
        return NextResponse.redirect(`${origin}/profile/setup`)
      }

      // 기존 유저 → 원래 가려던 페이지로
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }

  // 에러 시 로그인 페이지로
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
