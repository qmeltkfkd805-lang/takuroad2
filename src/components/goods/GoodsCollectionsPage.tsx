'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SettingsSubShell from '@/components/settings/SettingsSubShell'
import { EmptyState } from '@/components/tds'
import { getMyGoodsCollections, type GoodsCollection } from '@/services/goodsService'
import styles from './Goods.module.css'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function Collage({ covers }: { covers: (string | null)[] }) {
  const cells = [0, 1, 2, 3].map(i => covers[i] ?? null)
  return (
    <span className={styles.collage}>
      {cells.map((url, i) => (
        <span key={i} className={styles.collageCell}>
          {url
            ? <img className={styles.collageImg} src={url} alt="" loading="lazy" />
            : <span className={styles.collagePh}><svg width="20" height="20" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
        </span>
      ))}
    </span>
  )
}

export default function GoodsCollectionsPage() {
  const router = useRouter()
  const [cols, setCols] = useState<GoodsCollection[] | null>(null)
  const [error, setError] = useState(false)

  function load() {
    setError(false); setCols(null)
    getMyGoodsCollections().then(setCols).catch(() => { setError(true); setCols([]) })
  }
  useEffect(() => { load() }, [])

  // 작품 미지정 그룹은 항상 뒤로
  const sorted = (cols ?? []).slice().sort((a, b) => {
    if (a.workId === null) return 1
    if (b.workId === null) return -1
    return b.itemCount - a.itemCount
  })

  return (
    <SettingsSubShell title="작품별 컬렉션" onBack={() => router.back()}>
      <div className={styles.wrap}>
        <p className={styles.desc}>굿즈에 연결한 작품 기준으로 자동으로 묶여요. 폴더를 따로 만들 필요가 없어요.</p>

        {cols === null ? (
          <div className={styles.collGrid}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={`${styles.sk} ${styles.skCard}`} style={{ borderRadius: 16 }} />)}</div>
        ) : error ? (
          <div className={styles.state}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>컬렉션을 불러오지 못했어요</div>
            <button className={styles.stateBtn} onClick={load}>다시 시도</button>
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            title="아직 컬렉션이 없어요"
            description="굿즈를 올리고 작품을 연결하면 작품별 컬렉션이 자동으로 만들어져요."
            action={{ label: '새 굿즈 올리기', onClick: () => router.push('/profile/goods/new') }}
          />
        ) : (
          <div className={styles.collGrid}>
            {sorted.map(c => {
              const goTo = c.workId ? `/profile/collections/${c.workId}` : '/profile/collections/none'
              return (
                <button key={c.workId ?? 'none'} className={styles.collCard} onClick={() => router.push(goTo)}>
                  <Collage covers={c.recentCovers} />
                  <span className={styles.collBody}>
                    <span className={styles.collName}>{c.workName || '작품 미지정'}</span>
                    <span className={styles.collCount}>굿즈 {c.itemCount}개</span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </SettingsSubShell>
  )
}
