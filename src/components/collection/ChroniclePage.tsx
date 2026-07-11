'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getMyStories, Story } from '@/services/storyBuilder'
import { ROUTES } from '@/lib/constants/routes'
import StoryCard from './StoryCard'
import styles from './ChroniclePage.module.css'

export default function ChroniclePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getMyStories(user.id, 100)
      .then(setStories)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user])

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.signin}>
          <h1>나의 덕질 연대기</h1>
          <p>로그인하면 내가 다녀온 곳들이 시간순으로 쌓여요.</p>
          <button onClick={() => router.push(ROUTES.login)}>로그인하기</button>
        </div>
      </div>
    )
  }

  // 연도별로 나눠서 보여주기 (몇 년 쌓이면 구분이 필요)
  const byYear = new Map<string, Story[]>()
  for (const s of stories) {
    const y = s.date.slice(0, 4)
    if (!byYear.has(y)) byYear.set(y, [])
    byYear.get(y)!.push(s)
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <h1>나의 덕질 연대기</h1>
        <p>내가 언제, 어디를 다녀왔는지 — 시간이 지날수록 쌓이는 기록이에요.</p>
      </header>

      {loading ? (
        <div className={styles.skeleton}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className={styles.skelCard} />)}
        </div>
      ) : stories.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📖</div>
          <h2>아직 기록이 없어요</h2>
          <p>
            굿즈샵에 다녀오셨다면 샵 상세에서 <b>&ldquo;방문했어요&rdquo;</b>를 눌러보세요.<br />
            다녀온 곳들이 지역별로 묶여 하나의 이야기가 됩니다.
          </p>
          <button onClick={() => router.push('/map')}>지도에서 샵 찾기</button>
        </div>
      ) : (
        <div className={styles.timeline}>
          {Array.from(byYear.entries()).map(([year, list]) => (
            <section key={year} className={styles.yearBlock}>
              <div className={styles.yearMark}>
                <span className={styles.year}>{year}</span>
                <span className={styles.yearCount}>{list.length}개의 이야기</span>
              </div>
              <div className={styles.stories}>
                {list.map(s => <StoryCard key={s.key} story={s} />)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
