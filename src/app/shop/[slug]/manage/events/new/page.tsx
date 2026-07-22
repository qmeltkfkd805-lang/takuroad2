import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ShopEventForm from '@/components/shop/ShopEventForm'
import { ShopEventType } from '@/services/shopEventService'

const VALID: string[] = [
  'notice', 'event', 'restock', 'new_arrival',
  'sold_out', 'discount', 'reservation', 'exchange_meet', 'fan_meet',
]

interface Props {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ type?: string }>
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const { type } = await searchParams
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

  const initialType = type && VALID.includes(type) ? (type as ShopEventType) : undefined

  return <ShopEventForm shopId={shop.id} shopSlug={shop.slug} initialType={initialType} />
}