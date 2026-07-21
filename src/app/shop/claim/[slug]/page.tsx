import ClaimFormPage from '@/components/shop/ClaimFormPage'
export const metadata = { title: '사장님 인증 신청 · 타쿠로드' }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <ClaimFormPage slug={slug} />
}