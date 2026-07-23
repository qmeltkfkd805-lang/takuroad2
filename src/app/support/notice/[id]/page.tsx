import NoticeDetailPage from '@/components/notice/NoticeDetailPage'

export const metadata = { title: '공지사항 · 타쿠로드' }

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <NoticeDetailPage id={id} />
}