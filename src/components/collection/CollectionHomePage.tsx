'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { getCollectionHome, CollectionHome } from '@/services/collectionService'
import { getMyStories, Story } from '@/services/storyBuilder'
import StoryCard from './StoryCard'
import { ROUTES } from '@/lib/constants/routes'
import styles from './CollectionHomePage.module.css'

// 목업: 도장·기념품 (스키마 확정 후 실연결)
const MOCK_STAMPS = ['애니메이트', '안서당', '굿즈랩', '팝마트', '메가박스', '타임스퀘어', 'AK플라자', '코엑스']
const SOUVENIR_TABS = ['전체', '영수증', '티켓', '엽서', '포토카드', '스티커', '도장']

export default function CollectionHomePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<CollectionHome | null>(null)
  const [loading, setLoading] = useState(true)
  const [souvenirTab, setSouvenirTab] = useState('전체')
  const [stories, setStories] = useState<Story[]>([])

  useEffect(() => {
    if (!user) { setLoading(false); return }
    getCollectionHome(user.id).then(setData).catch(() => {}).finally(() => setLoading(false))
    // 최근 Story 3개 — 컬렉션 홈은 대시보드, 전체는 /chronicle
    getMyStories(user.id, 3).then(setStories).catch(() => {})
  }, [user])

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.signin}>
          <h1>나의 컬렉션</h1>
          <p>로그인하면 방문한 굿즈샵과 작품, 지역, 루트의 여정을 모아볼 수 있어요.</p>
          <button onClick={() => router.push(ROUTES.login)}>로그인하기</button>
        </div>
      </div>
    )
  }

  const s = data?.summary
  const works = data?.works ?? []
  const nearComplete = works.filter(w => w.pct > 0 && w.pct < 100).slice(0, 3)
  const routes = data?.routesInProgress ?? []
  const recent = data?.recentVisits ?? []

  return (
    <div className={styles.page}>
      {/* 상단 툴바 */}
      <header className={styles.topbar}>
        <div>
          <h1>나의 컬렉션</h1>
          <p>내가 방문한 굿즈샵과 작품, 지역, 루트의 여정을 한눈에 확인하세요.</p>
        </div>
        <div className={styles.topActions}>
          <button className={styles.ghostBtn} disabled>📅 캘린더</button>
          <button className={styles.ghostBtn} disabled>↗ 공유</button>
          <button className={styles.primaryBtn} onClick={() => router.push('/map')}>+ 방문한 샵 추가</button>
        </div>
      </header>

      {/* Hero + 요약 5칸 */}
      <section className={styles.hero}>
        <h2>나의 덕질 여정은 어디까지 왔을까요?</h2>
        <div className={styles.statRow}>
          <Stat tone="pink"   label="방문한 샵"    value={s ? `${s.visitedShops}` : '—'} sub={s ? `방문 완료` : ''} />
          <Stat tone="violet" label="작품 컬렉션"   value={s ? `${s.collectedWorks}` : '—'} sub={s ? `/ ${s.totalWorks}` : ''} pct={s && s.totalWorks ? Math.round(s.collectedWorks / s.totalWorks * 100) : undefined} />
          <Stat tone="teal"   label="지역 컬렉션"   value="12" sub="/ 35" pct={34} mock />
          <Stat tone="orange" label="완주한 루트"   value={s ? `${s.activeRoutes}` : '—'} sub="진행중" />
          <Stat tone="gold"   label="획득한 도장"   value="37" sub="전체 84개" mock />
        </div>
      </section>

      {/* 나의 덕질 연대기 — 최근 Story (전체는 /chronicle) */}
      <section className={styles.recentBlock}>
        <div className={styles.blockHead}>
          <h3>나의 덕질 연대기</h3>
          <button className={styles.moreLink} onClick={() => router.push('/chronicle')}>
            연대기 전체 보기 ›
          </button>
        </div>
        {loading ? (
          <div className={styles.storyList}>
            {Array.from({ length: 2 }).map((_, i) => <div key={i} className={styles.storySkel} />)}
          </div>
        ) : stories.length === 0 ? (
          <Empty
            text="아직 기록이 없어요. 다녀온 굿즈샵에서 ‘방문했어요’를 누르면, 지역별로 묶여 하나의 이야기가 됩니다."
            cta="지도에서 샵 찾기"
            onClick={() => router.push('/map')}
          />
        ) : (
          <div className={styles.storyList}>
            {stories.map(s => <StoryCard key={s.key} story={s} />)}
          </div>
        )}
      </section>

      {/* 본문 그리드: 좌(3컬럼) + 우(레일) */}
      <div className={styles.grid}>
        <div className={styles.left}>
          {/* 작품 / 지역 / 루트 3컬럼 */}
          <div className={styles.triCol}>
            {/* 작품 컬렉션 — 실데이터 */}
            <section className={styles.block}>
              <div className={styles.blockHead}><h3>작품 컬렉션</h3><button className={styles.moreLink} onClick={() => router.push('/shops/all')}>전체 보기 ›</button></div>
              {works.length === 0 ? <MiniEmpty text="방문하면 작품이 모여요" /> : (
                <ul className={styles.progList}>
                  {works.slice(0, 4).map(w => (
                    <li key={w.id} onClick={() => w.slug && router.push(`/shops/all?works=${w.slug}`)}>
                      <div className={styles.progIcon} />
                      <div className={styles.progBody}>
                        <div className={styles.progName}>{w.name}</div>
                        <div className={styles.progNum}>{w.collected} / {w.total}</div>
                        <div className={styles.bar}><span style={{ width: `${w.pct}%` }} /></div>
                      </div>
                      <div className={styles.progPct}>{w.pct}%</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* 지역 컬렉션 — 목업 */}
            <section className={styles.block}>
              <div className={styles.blockHead}><h3>지역 컬렉션</h3><span className={styles.soon}>준비 중</span></div>
              <ul className={styles.progList}>
                {[['홍대', 12, 35, 34], ['수원', 4, 18, 22], ['강남', 7, 21, 33], ['부산', 2, 15, 13]].map(([name, c, t, pct]) => (
                  <li key={name as string} className={styles.mockRow}>
                    <div className={styles.progIcon} />
                    <div className={styles.progBody}>
                      <div className={styles.progName}>{name}</div>
                      <div className={styles.progNum}>{c} / {t}</div>
                      <div className={styles.bar}><span style={{ width: `${pct}%` }} /></div>
                    </div>
                    <div className={styles.progPct}>{pct}%</div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 루트 컬렉션 — 진행중 실데이터 */}
            <section className={styles.block}>
              <div className={styles.blockHead}><h3>루트 컬렉션</h3><button className={styles.moreLink} onClick={() => router.push(ROUTES.routes)}>전체 보기 ›</button></div>
              {routes.length === 0 ? <MiniEmpty text="루트를 시작하면 여기 표시돼요" /> : (
                <ul className={styles.routeMini}>
                  {routes.slice(0, 4).map(r => (
                    <li key={r.id} onClick={() => r.shareToken && router.push(`/routes/${r.shareToken}`)}>
                      <div className={styles.routeThumb}>{r.cover ? <img src={r.cover} alt="" /> : <span className={styles.routeThumbEmpty} />}</div>
                      <div className={styles.routeBody}>
                        <div className={styles.progName}>{r.title}</div>
                        <div className={styles.progNum}>{r.visited} / {r.total}</div>
                        <div className={styles.bar}><span style={{ width: `${r.pct}%` }} /></div>
                      </div>
                      <div className={r.pct === 100 ? styles.routeDone : styles.routeOpen}>{r.pct === 100 ? '✓' : `${r.pct}%`}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* 기념품 보관함 — 목업 */}
          <section className={styles.block}>
            <div className={styles.blockHead}><h3>기념품 보관함</h3><span className={styles.soon}>준비 중</span></div>
            <div className={styles.souvenirTabs}>
              {SOUVENIR_TABS.map(tab => (
                <button key={tab} className={tab === souvenirTab ? styles.tabOn : styles.tab} onClick={() => setSouvenirTab(tab)}>{tab}</button>
              ))}
            </div>
            <div className={styles.souvenirRow}>
              {['애니메이트 영수증', '안서당 구매 영수증', '메가박스 티켓', '블루아카 엽서', '포토카드 세트', '원피스 스티커', '굿즈랩 도장'].map((k, i) => (
                <div key={i} className={styles.souvenirCard}><span className={styles.souvenirIcon} /><div className={styles.souvenirName}>{k}</div></div>
              ))}
              <div className={styles.souvenirAdd}>+<span>추가하기</span></div>
            </div>
          </section>
        </div>

        {/* 우측 레일 */}
        <aside className={styles.rail}>
          {/* 다음 목표 추천 */}
          <section className={styles.block}>
            <div className={styles.blockHead}><h3>🔥 다음 목표 추천</h3><button className={styles.moreLink}>전체 보기 ›</button></div>
            {nearComplete.length > 0 ? nearComplete.map(w => (
              <div key={w.id} className={styles.goalRow}>
                <div className={styles.goalIcon} />
                <div className={styles.goalBody}>
                  <div className={styles.goalTitle}>{w.name} 컬렉션</div>
                  <div className={styles.goalSub}>{w.total - w.collected}곳만 더 방문하면 완성!</div>
                  <div className={styles.bar}><span style={{ width: `${w.pct}%` }} /></div>
                </div>
                <button className={styles.goalBtn} onClick={() => w.slug && router.push(`/shops/all?works=${w.slug}`)}>추천 샵 보기</button>
              </div>
            )) : <p className={styles.railEmpty}>방문을 쌓으면 “거의 다 모은” 작품을 콕 집어 알려드릴게요.</p>}
          </section>

          {/* 도장 보관함 — 목업 */}
          <section className={styles.block}>
            <div className={styles.blockHead}><h3>도장 보관함</h3><span className={styles.soon}>준비 중</span></div>
            <div className={styles.stampGrid}>
              {MOCK_STAMPS.map((name, i) => (
                <div key={i} className={styles.stampCell}>
                  <div className={styles.stamp} data-i={i % 5} />
                  <div className={styles.stampName}>{name}</div>
                </div>
              ))}
            </div>
            <div className={styles.stampFoot}>
              <span>획득한 도장 <b>37</b> / 84</span>
              <button className={styles.moreLink}>도장 모아보기</button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Stat({ tone, label, value, sub, pct, mock }: { tone: string; label: string; value: string; sub?: string; pct?: number; mock?: boolean }) {
  return (
    <div className={styles.stat} data-tone={tone}>
      <div className={styles.statIcon} />
      <div className={styles.statBody}>
        <div className={styles.statLabel}>{label}{mock && <span className={styles.mockDot} />}</div>
        <div className={styles.statValueRow}>
          <span className={styles.statValue}>{value}</span>
          {sub && <span className={styles.statSub}>{sub}</span>}
        </div>
        {typeof pct === 'number' && <div className={styles.statPct}>{pct}%</div>}
      </div>
    </div>
  )
}

function Empty({ text, cta, onClick }: { text: string; cta: string; onClick: () => void }) {
  return <div className={styles.empty}><p>{text}</p><button onClick={onClick}>{cta}</button></div>
}
function MiniEmpty({ text }: { text: string }) {
  return <p className={styles.miniEmpty}>{text}</p>
}
