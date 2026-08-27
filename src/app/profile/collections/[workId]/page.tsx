import GoodsCollectionDetail from '@/components/goods/GoodsCollectionDetail'

export default async function Page({ params }: { params: Promise<{ workId: string }> }) {
  const { workId } = await params
  return <GoodsCollectionDetail workId={workId === 'none' ? null : workId} />
}
