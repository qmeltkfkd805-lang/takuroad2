import EventSubmitPage from '@/components/event/EventSubmitPage'

interface Props {
  searchParams: Promise<{ tag?: string; shop?: string }>
}

export default async function Page({ searchParams }: Props) {
  const { tag, shop } = await searchParams
  return <EventSubmitPage initialTagId={tag} initialShopSlug={shop} />
}