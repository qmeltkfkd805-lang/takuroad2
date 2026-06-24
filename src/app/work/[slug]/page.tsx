import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import WorkHomePage from '@/components/work/WorkHomePage'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WorkSlugPage({ params }: Props) {
  const { slug } = await params
  const [tag, shops] = await Promise.all([
    getTagBySlug(slug),
    getShopsByTag(slug),
  ])

  if (!tag) notFound()

  return <WorkHomePage tag={tag} shops={shops} />
}