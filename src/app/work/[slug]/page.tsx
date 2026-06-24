import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import { getProductsByTag } from '@/services/shopProductService'
import WorkHomePage from '@/components/work/WorkHomePage'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WorkSlugPage({ params }: Props) {
  const { slug } = await params
  const tag = await getTagBySlug(slug)
  if (!tag) notFound()

  const [goods, shops] = await Promise.all([
    getProductsByTag(tag.id),
    getShopsByTag(slug),
  ])

  return <WorkHomePage tag={tag} goods={goods} shops={shops} />
}