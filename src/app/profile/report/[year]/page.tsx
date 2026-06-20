import YearlyReportPage from '@/components/passport/YearlyReportPage'

interface Props {
  params: Promise<{ year: string }>
}

export async function generateMetadata({ params }: Props) {
  const { year } = await params
  return { title: `${year}년 타쿠로드 리포트` }
}

export default async function Report({ params }: Props) {
  const { year } = await params
  return <YearlyReportPage year={parseInt(year)} />
}