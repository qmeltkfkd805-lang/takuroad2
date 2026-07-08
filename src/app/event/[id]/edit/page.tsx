import EventFormWizard from '@/components/event/EventFormWizard'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <EventFormWizard editId={id} />
}
