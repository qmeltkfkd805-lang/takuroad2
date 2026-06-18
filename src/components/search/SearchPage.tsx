'use client'

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { searchShops } from '@/services/shopService'
import { Shop } from '@/types/shop'
import { ROUTES } from '@/lib/constants/routes'
import ShopCard from '@/components/shop/ShopCard'
import { useDebounce } from '@/hooks/useDebounce'

export default function SearchPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') ?? ''

  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Shop[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setSearched(false)
      return
    }
    setLoading(true)
    searchShops(debouncedQuery).then(data => {
      setResults(data)
      setLoading(false)
      setSearched(true)
    })
  }, [debouncedQuery])

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
          placeholder="샵 이름, 지역, 카테고리 검색..."
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

      {/* 결과 */}
      <div>
        {loading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
            검색 중...
          </div>
        )}

        {!loading && searched && results.length === 0 && (
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

        {!loading && results.length > 0 && (
          <>
            <div style={{
              padding: '10px 16px', fontSize: '13px', color: 'var(--muted)',
              borderBottom: '1px solid var(--border)',
            }}>
              검색 결과 {results.length}개
            </div>
            {results.map(shop => (
              <Link key={shop.id} href={ROUTES.shop(shop.slug)} style={{ textDecoration: 'none', color: 'inherit' }}>
                <ShopCard shop={shop} isActive={false} onClick={() => {}} />
              </Link>
            ))}
          </>
        )}

        {!query && !searched && (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
              샵 이름, 지역, 카테고리로 검색해보세요
            </p>
          </div>
        )}
      </div>
    </div>
  )
}