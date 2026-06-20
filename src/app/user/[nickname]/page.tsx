import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { getPublicPassport } from '@/services/passportService'
import PublicPassportPage from '@/components/passport/PublicPassportPage'

interface Props {
  params: Promise<{ nickname: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nickname } = await params
  const decoded = decodeURIComponent(nickname)
  const passport = await getPublicPassport(decoded)

  if (!passport) return { title: '프로필을 찾을 수 없어요' }

  return {
    title: `${passport.nickname}님의 오타쿠 패스포트 - 타쿠로드`,
    description: passport.tagline,
  }
}

export default async function UserPage({ params }: Props) {
  const { nickname } = await params
  const decoded = decodeURIComponent(nickname)
  const passport = await getPublicPassport(decoded)

  if (!passport) notFound()

  return <PublicPassportPage passport={passport} />
}