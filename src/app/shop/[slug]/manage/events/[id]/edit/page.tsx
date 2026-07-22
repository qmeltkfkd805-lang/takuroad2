import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getShopEventById } from '@/services/shopEventService'
import ShopEventForm from '@/components/shop/ShopEventForm'

interface Props {
  params: Promise<{ slug: string; id: string }>
}

export default async function Page({ params }: Props) {
  const { slug, id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: shop } = await supabase
    .from('shops')
    .select('id, slug, is_claimed, owner_id')
    .eq('slug', slug)
    .maybeSingle()
  if (!shop) notFound()
  if (!shop.is_claimed || shop.owner_id !== user.id) redirect('/shop/' + slug)

  const { data: ev } = await supabase
    .from('shop_events')
    .select('*')
    .eq('id', id)
    .eq('shop_id', shop.id)
    .maybeSingle()
  if (!ev) notFound()

  return <ShopEventForm shopId={shop.id} shopSlug={shop.slug} event={ev} />
}