import ExhibitPublicPage from '@/components/exhibit/ExhibitPublicPage'

export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ nickname: string }> }) {
  const { nickname } = await params
  return <ExhibitPublicPage nickname={decodeURIComponent(nickname)} />
}
