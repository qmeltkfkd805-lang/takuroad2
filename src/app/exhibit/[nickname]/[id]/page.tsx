import ExhibitDetailView from '@/components/exhibit/ExhibitDetailView'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ nickname: string; id: string }> }) {
  const { nickname, id } = await params
  return <ExhibitDetailView id={id} homeHref={`/exhibit/${encodeURIComponent(nickname)}`} />
}
