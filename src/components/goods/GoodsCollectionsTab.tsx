'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { EmptyState } from '@/components/tds'
import {
  getMyGoodsCollections, getCollectionCovers, resolveGoodsItemCovers,
  type GoodsCollection,
} from '@/services/goodsService'
import styles from './Goods.module.css'

/* 작품별 컬렉션 탭 — 마운트 시 1회 로드(lazy). work_id 기준 자동 집계.
   각 카드는 단일 대표 이미지(대표 지정값 → 최근 굿즈 → 작품 이미지 순). 대표 지정은 컬렉션 상세에서. */

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function CollCover({ url }: { url: string | null }) {
  return (
    <span className={styles.collage} style={{ display: 'block', position: 'relative' }}>
      {url
        ? <img className={styles.collageImg} src={url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span className={styles.collagePh} style={{ position: 'absolute', inset: 0 }}><svg width="26" height="26" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
    </span>
  )
}

export default function GoodsCollectionsTab() {
  const router = useRouter()
  const [cols, setCols] = useState<GoodsCollection[] | null>(null)
  const [error, setError] = useState(false)
  const [coverMap, setCoverMap] = useState<Record<string, string>>({})   // work_id -> cover_item_id
  const [coverUrls, setCoverUrls] = useState<Record<string, string | null>>({}) // cover_item_id -> url

  async function load() {
    setError(false); setCols(null)
    try {
      const [cs, cm] = await Promise.all([getMyGoodsCollections(), getCollectionCovers()])
      setCols(cs); setCoverMap(cm)
      const ids = Object.values(cm)
      if (ids.length) setCoverUrls(await resolveGoodsItemCovers(ids))
    } catch { setError(true); setCols([]) }
  }
  useEffect(() => { load() }, [])

  const sorted = (cols ?? []).slice().sort((a, b) => {
    if (a.workId === null) return 1
    if (b.workId === null) return -1
    return b.itemCount - a.itemCount
  })

  function displayUrl(c: GoodsCollection): string | null {
    const chosen = c.workId ? coverMap[c.workId] : null
    const chosenUrl = chosen ? coverUrls[chosen] : null
    return chosenUrl ?? c.recentCovers.find(Boolean) ?? c.coverUrl ?? null
  }

  if (cols === null) {
    return <div className={styles.collGrid}>{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={`${styles.sk} ${styles.skCard}`} style={{ borderRadius: 16 }} />)}</div>
  }
  if (error) {
    return (
      <div className={styles.state}>
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>컬렉션을 불러오지 못했어요</div>
        <button className={styles.stateBtn} onClick={load}>다시 시도</button>
      </div>
    )
  }
  if (sorted.length === 0) {
    return (
      <EmptyState
        title="아직 컬렉션이 없어요"
        description="굿즈를 올리고 작품을 연결하면 작품별 컬렉션이 자동으로 만들어져요."
        action={{ label: '첫 굿즈 기록하기', onClick: () => router.push('/community/write?board=goods') }}
      />
    )
  }

  return (
    <div className={styles.collGrid}>
      {sorted.map(c => {
        const goTo = c.workId ? `/profile/collections/${c.workId}` : '/profile/collections/none'
        return (
          <button key={c.workId ?? 'none'} className={styles.collCard} onClick={() => router.push(goTo)}>
            <CollCover url={displayUrl(c)} />
            <span className={styles.collBody}>
              <span className={styles.collName}>{c.workName || '작품 미지정'}</span>
              <span className={styles.collCount}>굿즈 {c.itemCount}개</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
