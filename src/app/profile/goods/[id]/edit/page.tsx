import GoodsForm from '@/components/goods/GoodsForm'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <GoodsForm mode="edit" id={id} />
}
