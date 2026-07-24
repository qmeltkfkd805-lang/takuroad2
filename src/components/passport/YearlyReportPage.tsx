'use client'
import AppIcon from '@/components/tds/AppIcon'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getYearlyReport, getAvailableYears, YearlyReport } from '@/services/yearlyReportService'
import { ROUTES } from '@/lib/constants/routes'

interface Props {
  year: number
}

export default function YearlyReportPage({ year }: Props) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [report, setReport] = useState<YearlyReport | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push(ROUTES.login)
      return
    }
    Promise.all([
      getYearlyReport(user.id, year),
      getAvailableYears(user.id),
    ]).then(([r, y]) => {
      setReport(r)
      setYears(y)
      setLoading(false)
    })
  }, [user, authLoading, year, router])

  async function handleShare() {
    const text = `${year}년 나의 타쿠로드 리포트\n\n방문한 샵 ${report?.visitedShopCount}곳\n가장 많이 찾은 작품: ${report?.topSeries ?? '없음'}\n획득한 배지 ${report?.badgesEarnedCount}개`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${year}년 타쿠로드 리포트`, text })
      } catch {}
    } else {
      await navigator.clipboard.writeText(text)
      alert('리포트 내용이 복사됐어요!')
    }
  }

  if (loading || authLoading || !report) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
        ><AppIcon name="arrow-left" size={20} /></button>
        <h1 style={{ fontSize: '16px', fontWeight: 900, flex: 1 }}>{year}년 리포트</h1>

        {years.length > 1 && (
          <select
            value={year}
            onChange={e => router.push(`/profile/report/${e.target.value}`)}
            style={{
              padding: '6px 10px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--surface2)',
              fontSize: '13px', fontFamily: 'inherit',
            }}
          >
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
        )}
      </div>

      {/* 리포트 카드 */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #ff6b9d 100%)',
        color: '#fff', margin: '20px', borderRadius: '24px', padding: '32px 24px',
      }}>
        <div style={{
          fontFamily: "'Cute Font', cursive",
          fontSize: '16px', letterSpacing: '2px', marginBottom: '4px', opacity: 0.9,
        }}>
          TAKUROAD
        </div>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '24px', whiteSpace: 'nowrap' }}>
          <AppIcon name="note" size={22} style={{ marginRight: 6, verticalAlign: '-3px' }} />{year} 타쿠로드 리포트
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <ReportStat label="방문한 샵" value={`${report.visitedShopCount}곳`} />
          <ReportStat label="작성한 후기" value={`${report.reviewCount}개`} />
          <ReportStat label="획득한 배지" value={`${report.badgesEarnedCount}개`} />
          <ReportStat label="완료한 루트" value={`${report.routesCompletedCount}개`} />
        </div>

        {report.topSeries && (
          <ReportLine label="가장 많이 찾은 작품" value={report.topSeries} />
        )}
        {report.topRegion && (
          <ReportLine label="가장 많이 간 지역" value={report.topRegion} />
        )}
        {report.mostVisitedShop && (
          <ReportLine label="올해 가장 많이 간 샵" value={report.mostVisitedShop.name} />
        )}
      </div>

      {/* 공유 버튼 */}
      <div style={{ padding: '0 20px 30px' }}>
        <button
          onClick={handleShare}
          style={{
            width: '100%', padding: '13px', borderRadius: '12px',
            background: 'var(--accent)', color: '#fff', border: 'none',
            fontWeight: 900, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap',
          }}
        >
          <AppIcon name="link" size={15} style={{ marginRight: 5, verticalAlign: '-2px' }} />리포트 공유하기
        </button>
      </div>

      {report.visitedShopCount === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '0 20px 40px' }}>
          {year}년에는 아직 활동 기록이 없어요
        </p>
      )}
    </div>
  )
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '28px', fontWeight: 900 }}>{value}</div>
      <div style={{ fontSize: '12px', opacity: 0.85 }}>{label}</div>
    </div>
  )
}

function ReportLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      padding: '10px 0', borderTop: '1px solid rgba(255,255,255,.25)',
      fontSize: '14px',
    }}>
      <span style={{ opacity: 0.85 }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  )
}