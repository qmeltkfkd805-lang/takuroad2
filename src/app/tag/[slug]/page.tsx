import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTagBySlug, getShopsByTag } from '@/services/shopService'
import TagPage from '@/components/tag/TagPage'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTagBySlug(slug)
  if (!tag) return { title: '태그를 찾을 수 없어요' }

  return {
    title: `#${tag.name} 관련 샵`,
    description: `${tag.name} 관련 굿즈샵, 팝업스토어를 타쿠로드에서 찾아보세요.`,
    openGraph: {
      title: `#${tag.name} 관련 샵 - 타쿠로드`,
      description: `${tag.name} 관련 굿즈샵, 팝업스토어`,
    },
  }
}

export default async function TagSlugPage({ params }: Props) {
  const { slug } = await params
  const [tag, shops] = await Promise.all([
    getTagBySlug(slug),
    getShopsByTag(slug),
  ])

  if (!tag) notFound()

  return <TagPage tag={tag} shops={shops} />
}