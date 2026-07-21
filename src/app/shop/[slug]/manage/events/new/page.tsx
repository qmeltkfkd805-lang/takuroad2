import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShopEventForm from '@/components/shop/ShopEventForm'

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
    .select('id, slug, is_claimed, owner_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!shop) notFound()
  if (!shop.is_claimed || shop.owner_id !== user.id) redirect(`/shop/${slug}`)

  return <ShopEventForm shopId={shop.id} shopSlug={shop.slug} />
}