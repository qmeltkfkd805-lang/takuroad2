import ExhibitEditView from '@/components/exhibit/ExhibitEditView'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExhibitEditView id={id} />
}
