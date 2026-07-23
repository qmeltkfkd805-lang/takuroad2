'use client'
import { useState } from 'react'
import Link from 'next/link'
import { searchShops } from '@/services/shopService'
import { Shop } from '@/types/shop'
import styles from './claim.module.css'
import AppIcon from '@/components/tds/AppIcon'

const BENEFITS = [
  '영업시간 수정', '휴무 공지 등록', '이벤트 등록', '굿즈 입고 소식',
  '매장 사진 관리', '매장 정보 수정', '인증 배지 표시',
]

export default function ClaimShopPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Shop[]>([])
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  async function doSearch() {
    if (!query.trim()) return
    setLoading(true)
    const r = await searchShops(query)
    setResults(r)
    setSearched(true)
    setLoading(false)
  }

  return (
    <div className={styles.wrap}>
      <section className={styles.intro}>
        <span className={styles.badge}>사장님 인증</span>
        <h1 className={styles.title}>내 매장, 직접 관리하세요</h1>
        <p className={styles.desc}>사장님 인증을 받으면 매장을 직접 관리할 수 있어요.</p>
        <div className={styles.benefits}>
          {BENEFITS.map(b => (
            <div key={b} className={styles.benefit}><span className={styles.check}>✓</span>{b}</div>
          ))}
        </div>
      </section>

      <section className={styles.search}>
        <h2 className={styles.searchTitle}>내 매장 찾기</h2>
        <p className={styles.searchHint}>운영 중인 매장을 검색해 주세요.</p>
        <div className={styles.searchBar}>
          <input
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
            placeholder="매장명 검색 (예: 애니메이트 홍대)"
          />
          <button className={styles.searchBtn} onClick={doSearch} disabled={loading}>
            {loading ? '검색 중…' : '검색'}
          </button>
        </div>

        {searched && (
          <div className={styles.results}>
            {results.length > 0 ? (
              results.map(shop => (
                <div key={shop.id} className={styles.resultCard}>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{shop.name}</div>
                    <div className={styles.resultAddr}>{shop.addr || '주소 미등록'}</div>
                  </div>
                  <Link href={`/shop/claim/${shop.slug}`} className={styles.claimBtn}>이 매장 인증하기</Link>
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                <p className={styles.emptyText}>검색 결과가 없어요.</p>
              </div>
            )}
            <div className={styles.noneBox}>
              <span className={styles.noneText}>찾는 매장이 없나요?</span>
              <Link href="/shop/new" className={styles.newBtn}>새 매장 등록 후 인증 →</Link>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}