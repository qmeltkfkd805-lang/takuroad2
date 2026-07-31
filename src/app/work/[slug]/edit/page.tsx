export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { getTagBySlug } from '@/services/shopService'
import WorkRegister from '@/components/work/WorkRegister'

export const metadata = {
  title: '작품 수정',
}

interface Props {
  params: Promise<{ slug: string }>
}

export default async function WorkEditPage({ params }: Props) {
  const { slug } = await params
  const tag = await getTagBySlug(slug)
  if (!tag) notFound()

  return <WorkRegister mode="edit" editId={tag.id} />
}
