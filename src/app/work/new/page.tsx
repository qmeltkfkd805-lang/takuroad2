import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import WorkRegister from '@/components/work/WorkRegister'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: '작품 등록',
}

/* 작품 생성은 관리자만 가능하다.
   중복 작품을 합치고 잘못 등록된 작품을 정리할 절차가 아직 없어서,
   그 절차를 마련할 때까지 신규 생성을 관리자에게 한정한다.
   기존 작품을 검색·선택하는 기능(샵 취급 작품, 상위 작품 선택)은 그대로 열려 있다.
   ⚠️ 이 화면 판정은 안내일 뿐이다. 실제 차단은 tags INSERT 정책이 한다. */
export default async function WorkNewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    isAdmin = (profile as { role?: string } | null)?.role === 'admin'
  }

  if (!isAdmin) {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '72px 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 12px' }}>작품 등록은 현재 관리자만 가능합니다</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.75, margin: '0 0 28px' }}>
          중복 작품을 합치고 잘못 등록된 작품을 정리할 절차를 먼저 마련하고 있어요.
          준비되는 대로 다시 열 예정입니다. 등록하고 싶은 작품이 있으면 알려주세요.
        </p>
        <Link href="/work/request" style={{ display: 'inline-block', padding: '12px 22px', borderRadius: 12, background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 14, textDecoration: 'none' }}>작품 추가 요청</Link>
      </div>
    )
  }

  return <WorkRegister />
}
