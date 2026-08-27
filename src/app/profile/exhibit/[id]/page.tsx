import ExhibitDetailView from '@/components/exhibit/ExhibitDetailView'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExhibitDetailView id={id} />
}
