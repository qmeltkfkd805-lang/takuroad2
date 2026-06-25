import EventSubmitPage from '@/components/event/EventSubmitPage'

interface Props {
  searchParams: Promise<{ tag?: string }>
}

export default async function Page({ searchParams }: Props) {
  const { tag } = await searchParams
  return <EventSubmitPage initialTagId={tag} />
}