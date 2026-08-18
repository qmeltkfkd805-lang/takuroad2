'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import SettingsSubShell from '@/components/settings/SettingsSubShell'
import { getReportCardData, getAvailableYears, type ReportCardData } from '@/services/yearlyReportService'
import ReportShareCard from '@/components/report/ReportShareCard'
import styles from './YearlyReportPage.module.css'

interface Props { year: number }

export default function YearlyReportPage({ year }: Props) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState<ReportCardData | null>(null)
  const [years, setYears] = useState<number[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading || !user) return
    setLoading(true)
    Promise.all([
      getReportCardData(user.id, year),
      getAvailableYears(user.id),
    ]).then(([d, y]) => { setData(d); setYears(y); setLoading(false) })
      .catch(() => setLoading(false))
  }, [user, authLoading, year])

  // 헤더 우측: 연도 선택(여러 해가 있을 때만)
  const yearSelect = years.length > 1 ? (
    <select
      value={year}
      onChange={e => router.push(`/profile/report/${e.target.value}`)}
      className={styles.yearSelect}
      aria-label="연도 선택"
    >
      {years.map(y => <option key={y} value={y}>{y}년</option>)}
    </select>
  ) : null

  return (
    <SettingsSubShell title={`${year}년 리포트`} onBack={() => router.back()} right={yearSelect}>
      <div className={styles.wrap}>
        <p className={styles.desc}>한 해 동안의 덕질 발자국을 이미지 한 장으로 저장하고 공유해요.</p>

        {loading || !data ? (
          <div className={styles.loading}>불러오는 중...</div>
        ) : !data.hasAnyActivity ? (
          <div className={styles.state}>
            <div className={styles.stateTitle}>{year}년에는 아직 활동 기록이 없어요</div>
            <div className={styles.stateDesc}>샵을 방문하거나 루트를 만들면 나만의 연간 리포트가 만들어져요.</div>
            <button className={styles.stateBtn} onClick={() => router.push('/shops')}>샵 둘러보기</button>
          </div>
        ) : (
          <ReportShareCard data={data} />
        )}
      </div>
    </SettingsSubShell>
  )
}
