import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin: rawOrigin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirect = searchParams.get('redirect') || '/shop/new'

  // Vercel 프록시 뒤에서는 request.url의 origin이 내부주소로 잡힐 수 있어
  // forwarded 헤더가 있으면 그걸로 실제 접속 origin을 재구성한다.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : rawOrigin

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, nickname')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!profile) {
        return NextResponse.redirect(`${origin}/profile/setup`)
      }
      return NextResponse.redirect(`${origin}${redirect}`)
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`)
}
