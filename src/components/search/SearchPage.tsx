'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { searchShops } from '@/services/shopService'
import { globalSearch, logSearchClick, GlobalSearchResult } from '@/services/globalSearchService'
import { getOrCreateAnonymousId } from '@/lib/utils/anonymousId'
import { useAuth } from '@/components/layout/AuthProvider'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import ShopCard from '@/components/shop/ShopCard'
import WorkTagBadges from '@/components/work/WorkTagBadges'
import { useDebounce } from '@/hooks/useDebounce'

const AVAILABILITY_LABEL: Record<string, string> = {
  unknown: '확인 안 됨', not_sold: '판매 안 함', sold_out: '품절',
  few: '소량', normal: '보통', many: '많음',
}

export default function SearchPage() {
  const router = useRouter()
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [shopResults, setShopResults] = useState<Shop[]>([])
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setShopResults([])
      setGlobalResults(null)
      setSearched(false)
      return
    }
    setLoading(true)
    Promise.all([
      searchShops(debouncedQuery),
      globalSearch(debouncedQuery, user?.id ?? null, getOrCreateAnonymousId()),
    ]).then(([shops, global]) => {
      setShopResults(shops)
      setGlobalResults(global)
      setLoading(false)
      setSearched(true)
    })
  }, [debouncedQuery, user])

  function handleProductClick(shopId: string, shopSlug: string) {
    logSearchClick(debouncedQuery, 'shop', shopId)
    router.push(`/shop/${shopSlug}`)
  }

  function handleShopClick(shopId: string) {
    logSearchClick(debouncedQuery, 'shop', shopId)
  }

  const hasGoodsResults = (globalResults?.products.length ?? 0) > 0
  const hasTagResults = (globalResults?.tags.length ?? 0) > 0
  const noResultsAtAll = searched && shopResults.length === 0 && !hasGoodsResults && !hasTagResults

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <button
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
        >←</button>

        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="샵, 작품, 캐릭터, 굿즈 검색..."
          autoFocus
          style={{
            flex: 1, padding: '10px 14px',
            border: '1.5px solid var(--border)', borderRadius: '10px',
            fontSize: '15px', fontFamily: 'inherit',
            background: 'var(--surface2)', color: 'var(--text)',
            outline: 'none',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}
          >✕</button>
        )}
      </div>

      <div>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            검색 중...
          </div>
        )}

        {!loading && noResultsAtAll && (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p style={{ fontWeight: 900, fontSize: '16px', marginBottom: '8px' }}>
              검색 결과가 없어요
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
              다른 검색어를 입력해보세요
            </p>
            <Link href={ROUTES.shopNew} style={{
              padding: '12px 24px', borderRadius: '12px',
              background: 'var(--accent)', color: '#fff',
              fontWeight: 700, fontSize: '14px',
            }}>
              샵 등록하기
            </Link>
          </div>
        )}

        {/* 굿즈 검색 결과 — 먼저 보여줌 (타쿠로드 핵심 차별점) */}
        {!loading && hasGoodsResults && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700,
              borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
            }}>
              🛍️ 굿즈 검색 결과 {globalResults!.products.length}개
            </div>
            {globalResults!.products.map((p, i) => (
              <div
                key={i}
                onClick={() => handleProductClick(p.shopId, p.shopSlug)}
                style={{
                  padding: '14px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '14px' }}>
                    {p.tagName} {p.characterName ? `· ${p.characterName}` : ''} · {p.goodsTypeName}
                  </span>
                  <span style={{
                    fontSize: '12px', fontWeight: 700,
                    color: p.availability === 'many' ? 'var(--green)' : p.availability === 'sold_out' ? 'var(--red)' : 'var(--muted)',
                  }}>
                    {AVAILABILITY_LABEL[p.availability]}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  📍 {p.shopName}
                  {p.confirmCount > 0 && <span> · 👥 {p.confirmCount}명 확인</span>}
                </div>
              </div>
            ))}
          </>
        )}

{/* 작품 검색 결과 */}
        {!loading && hasTagResults && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700,
              borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
            }}>
              🎮 작품 검색 결과 {globalResults!.tags.length}개
            </div>
            <div style={{ padding: '14px 16px' }}>
              <WorkTagBadges works={globalResults!.tags} />
            </div>
          </>
        )}
        
        {/* 샵 검색 결과 */}
        {!loading && shopResults.length > 0 && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700,
              borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
            }}>
              🏪 샵 검색 결과 {shopResults.length}개
            </div>
            {shopResults.map(shop => (
              <Link
                key={shop.id}
                href={ROUTES.shop(shop.slug)}
                onClick={() => handleShopClick(shop.id)}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <ShopCard shop={shop} isActive={false} onClick={() => {}} />
              </Link>
            ))}
          </>
        )}

        {!query && !searched && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              샵, 작품, 캐릭터, 굿즈로 검색해보세요
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '8px' }}>
              예: &quot;블루아카이브&quot;, &quot;아루 아크릴&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  )
}