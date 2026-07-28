import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import ShopEventManager from '@/components/shop/ShopEventManager'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function Page({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shop } = await supabase
    .from('shops')
    .select('id, slug, name, is_claimed, owner_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!shop) notFound()
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const isAdmin = (prof as any)?.role === 'admin'
  if (!isAdmin && (!shop.is_claimed || shop.owner_id !== user.id)) redirect('/shop/' + slug)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px 100px' }}>
      <Link href={'/shop/' + slug + '/manage'} style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>← 매장 관리</Link>
      <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', margin: '16px 0 8px' }}>이벤트 관리</h1>
      <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 24px' }}>정식 이벤트로 등록하거나, 간단한 매장 소식을 올릴 수 있어요.</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 36 }}>
        <Link href={'/event/new?shop=' + shop.slug} style={{
          display: 'flex', flexDirection: 'column', gap: 8, padding: '22px', textDecoration: 'none',
          background: 'linear-gradient(135deg, rgba(232,0,111,.08), rgba(232,0,111,.03))',
          border: '1px solid var(--border)', borderRadius: 16,
        }}>
          <span style={{ fontSize: 28 }}>🎉</span>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>정식 이벤트 등록</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>팝업스토어·전시처럼 이벤트 홈에 노출되는 이벤트</span>
        </Link>
        <Link href={'/shop/' + shop.slug + '/manage/events/new'} style={{
          display: 'flex', flexDirection: 'column', gap: 8, padding: '22px', textDecoration: 'none',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
        }}>
          <span style={{ fontSize: 28 }}>📢</span>
          <span style={{ fontSize: 15.5, fontWeight: 800, color: 'var(--text)' }}>매장 소식 등록</span>
          <span style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>공지·재입고·할인 같은 짧은 소식 (샵 상세에 표시)</span>
        </Link>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>등록된 매장 소식</span>
        <Link href={'/shop/' + shop.slug} target="_blank" style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>매장 페이지에서 확인 →</Link>
      </div>
      <ShopEventManager shopId={shop.id} shopSlug={shop.slug} hideForm />
    </div>
  )
}