'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import SettingsSubShell from '@/components/settings/SettingsSubShell'
import { EmptyState } from '@/components/tds'
import {
  getMyGoods, getMyGoodsCollections, getGoodsTypes,
  type GoodsListItem, type GoodsType, type GoodsCollection,
} from '@/services/goodsService'
import styles from './Goods.module.css'

const PAGE = 30
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const VIS_LABEL: Record<string, string> = { public: '', followers: '팔로워 공개', private: '비공개' }

function GoodsCard({ item, onClick }: { item: GoodsListItem; onClick: () => void }) {
  const vis = VIS_LABEL[item.visibility]
  return (
    <button className={styles.card} onClick={onClick}>
      <span className={styles.thumbWrap}>
        {item.cover.url
          ? <img className={styles.thumb} src={item.cover.url} alt={item.name ?? '굿즈'} loading="lazy" />
          : <span className={styles.thumbPh}><svg width="34" height="34" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
        {item.isFromCommunity && <span className={styles.badges}><span className={`${styles.pill} ${styles.pillCommunity}`}>굿즈 자랑</span></span>}
        {vis && <span className={styles.visPill}>{vis}</span>}
      </span>
      <span className={styles.body}>
        <span className={styles.name}>{item.name || item.goodsTypeName || '이름 없는 굿즈'}</span>
        {item.workName && <span className={styles.sub}>{item.workName}</span>}
        {item.pricePublic && item.price != null && <span className={styles.price}>{item.price.toLocaleString()}원</span>}
      </span>
    </button>
  )
}

export default function GoodsListPage() {
  const router = useRouter()

  const [types, setTypes] = useState<GoodsType[]>([])
  const [works, setWorks] = useState<{ id: string | null; name: string }[]>([])
  const [typeId, setTypeId] = useState<string | null>(null)
  const [workSel, setWorkSel] = useState<string>('all')   // 'all' | 'none'(미지정) | tagId

  const [items, setItems] = useState<GoodsListItem[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [moreLoading, setMoreLoading] = useState(false)
  const [error, setError] = useState(false)
  const reqRef = useRef(0)

  // 필터 카탈로그
  useEffect(() => {
    getGoodsTypes().then(setTypes).catch(() => setTypes([]))
    getMyGoodsCollections()
      .then(cs => setWorks(cs.filter(c => c.workId).map(c => ({ id: c.workId, name: c.workName || '작품' }))))
      .catch(() => setWorks([]))
  }, [])

  const params = useMemo(() => ({
    typeId: typeId ?? null,
    workId: workSel === 'all' || workSel === 'none' ? null : workSel,
    onlyUnassigned: workSel === 'none',
  }), [typeId, workSel])

  const loadFirst = useCallback(async () => {
    const rid = ++reqRef.current
    setLoading(true); setError(false); setItems([]); setCursor(null); setHasMore(false)
    try {
      const res = await getMyGoods({ ...params, limit: PAGE })
      if (rid !== reqRef.current) return
      setItems(res.items); setCursor(res.nextCursor); setHasMore(!!res.nextCursor)
    } catch {
      if (rid === reqRef.current) setError(true)
    } finally {
      if (rid === reqRef.current) setLoading(false)
    }
  }, [params])

  useEffect(() => { loadFirst() }, [loadFirst])

  async function loadMore() {
    if (moreLoading || !cursor) return
    setMoreLoading(true)
    const rid = reqRef.current
    try {
      const res = await getMyGoods({ ...params, before: cursor, limit: PAGE })
      if (rid !== reqRef.current) return
      setItems(prev => [...prev, ...res.items]); setCursor(res.nextCursor); setHasMore(!!res.nextCursor)
    } catch { /* keep */ } finally {
      setMoreLoading(false)
    }
  }

  const collectibleTypes = types.filter(t => t.isCollectible)
  const typeChips = collectibleTypes.length > 0 ? collectibleTypes : types

  return (
    <SettingsSubShell title="내 굿즈" onBack={() => router.back()}>
      <div className={styles.wrap}>
        <p className={styles.desc}>내가 모은 굿즈를 사진으로 모아봐요. 작품·종류로 필터할 수 있어요.</p>

        {/* 필터 */}
        <div className={styles.controls}>
          <div className={styles.chips}>
            <button className={`${styles.chip} ${typeId === null ? styles.chipOn : ''}`} onClick={() => setTypeId(null)}>전체</button>
            {typeChips.map(t => (
              <button key={t.id} className={`${styles.chip} ${typeId === t.id ? styles.chipOn : ''}`} onClick={() => setTypeId(t.id)}>{t.name}</button>
            ))}
          </div>
          {works.length > 0 && (
            <select className={styles.workSelect} value={workSel} onChange={e => setWorkSel(e.target.value)} aria-label="작품 필터">
              <option value="all">작품 전체</option>
              <option value="none">작품 미지정</option>
              {works.map(w => <option key={w.id} value={w.id!}>{w.name}</option>)}
            </select>
          )}
        </div>

        {/* 목록 */}
        {loading ? (
          <div className={styles.grid}>{[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} className={`${styles.sk} ${styles.skCard}`} />)}</div>
        ) : error ? (
          <div className={styles.state}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>굿즈를 불러오지 못했어요</div>
            <button className={styles.stateBtn} onClick={loadFirst}>다시 시도</button>
          </div>
        ) : items.length === 0 ? (
          typeId === null && workSel === 'all' ? (
            <EmptyState
              title="아직 등록한 굿즈가 없어요"
              description="사진 한 장이면 충분해요. 첫 굿즈를 올려보세요."
              action={{ label: '새 굿즈 올리기', onClick: () => router.push('/profile/goods/new') }}
            />
          ) : (
            <div className={styles.state}><div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--muted)' }}>조건에 맞는 굿즈가 없어요</div></div>
          )
        ) : (
          <>
            <div className={styles.grid}>
              {items.map(it => <GoodsCard key={it.id} item={it} onClick={() => router.push(`/profile/goods/${it.id}`)} />)}
            </div>
            {hasMore && (
              <div className={styles.moreWrap}>
                <button className={styles.moreBtn} onClick={loadMore} disabled={moreLoading}>{moreLoading ? '불러오는 중…' : '더 보기'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </SettingsSubShell>
  )
}
