import GoodsDetailView from '@/components/goods/GoodsDetailView'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GoodsDetailView id={id} />
}
