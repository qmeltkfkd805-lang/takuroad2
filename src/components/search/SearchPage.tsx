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
import SearchWorkHub from './SearchWorkHub'
import AppIcon from '@/components/tds/AppIcon'

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

  // 헤더 검색창에서 /search?q= 로 올 때 결과가 따라오도록 URL과 동기화
  useEffect(() => {
    setQuery(searchParams.get('q') ?? '')
  }, [searchParams])

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
  const matchedTag = (!loading && globalResults && globalResults.tags.length > 0) ? globalResults.tags[0] : null

  return (
    <div style={{ width: '100%', minHeight: '100dvh', background: 'var(--surface)' }}>

      {query.trim() && (
        <div style={{ padding: '20px 16px 10px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 900, margin: 0 }}>'{query.trim()}' 검색 결과</h1>
          {globalResults && (
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
              작품 {globalResults.tags.length} · 샵 {shopResults.length} · 굿즈 {globalResults.products.length}
            </p>
          )}
        </div>
      )}

      <div>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            검색 중...
          </div>
        )}

        {matchedTag && globalResults && (
          <SearchWorkHub tag={matchedTag} products={globalResults.products} />
        )}

        {!loading && noResultsAtAll && (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <AppIcon name="search" size={48} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 900, fontSize: '16px', marginBottom: '8px' }}>
              검색 결과가 없어요
            </p>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
              원하는 작품이 없나요? 직접 작품을 등록해보세요.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/work/new" style={{
                padding: '12px 22px', borderRadius: '12px',
                background: 'var(--accent)', color: '#fff',
                fontWeight: 800, fontSize: '14px', textDecoration: 'none',
              }}>+ 직접 작품 등록하기</Link>
              <Link href={ROUTES.shopNew} style={{
                padding: '12px 22px', borderRadius: '12px',
                border: '1px solid var(--border)', color: 'var(--text)',
                fontWeight: 700, fontSize: '14px', textDecoration: 'none',
              }}>샵 등록하기</Link>
            </div>
          </div>
        )}

        {!loading && !matchedTag && hasGoodsResults && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700,
              borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
            }}>
              <AppIcon name="bag" size={15} style={{ marginRight: 6 }} />굿즈 검색 결과 {globalResults!.products.length}개
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
                  <AppIcon name="pin" size={12} style={{ marginRight: 4 }} />{p.shopName}
                  {p.confirmCount > 0 && <span> · <AppIcon name="users" size={12} style={{ marginRight: 4 }} />{p.confirmCount}명 확인</span>}
                </div>
              </div>
            ))}
          </>
        )}

        {!loading && !matchedTag && hasTagResults && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700,
              borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
            }}>
              <AppIcon name="game" size={15} style={{ marginRight: 6 }} />작품 검색 결과 {globalResults!.tags.length}개
            </div>
            <div style={{ padding: '14px 16px' }}>
              <WorkTagBadges works={globalResults!.tags} />
            </div>
          </>
        )}

        {!loading && searched && !matchedTag && !hasTagResults && !noResultsAtAll && (
          <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', background: 'var(--surface2)', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>찾는 작품이 없나요? 직접 등록해보세요.</span>
            <Link href="/work/new" style={{ padding: '8px 16px', borderRadius: '9999px', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: '13px', textDecoration: 'none', flexShrink: 0 }}>+ 작품 등록</Link>
          </div>
        )}

        {!loading && !matchedTag && shopResults.length > 0 && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)', fontWeight: 700,
              borderBottom: '1px solid var(--border)', background: 'var(--surface2)',
            }}>
              <AppIcon name="shop" size={15} style={{ marginRight: 6 }} />샵 검색 결과 {shopResults.length}개
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
            <AppIcon name="search" size={48} color="var(--muted)" style={{ margin: '0 auto 16px' }} />
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