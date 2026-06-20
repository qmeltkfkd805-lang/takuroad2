'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { getPublicRoutes, getAllRegions, getAllSeriesTags } from '@/services/routeService'
import { formatDistance } from '@/hooks/useCurrentLocation'

type FilterType = 'all' | 'region' | 'series'

export default function RouteExplorePage() {
  const router = useRouter()
  const [routes, setRoutes] = useState<any[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [seriesTags, setSeriesTags] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getAllRegions(),
      getAllSeriesTags(),
    ]).then(([r, s]) => {
      setRegions(r)
      setSeriesTags(s)
    })
    loadRoutes()
  }, [])

  async function loadRoutes(filters?: { region?: string; tag?: string }) {
    setLoading(true)
    const data = await getPublicRoutes(filters)
    setRoutes(data)
    setLoading(false)
  }

  function handleFilterTypeChange(type: FilterType) {
    setFilterType(type)
    setSelectedFilter(null)
    loadRoutes()
  }

  function handleFilterSelect(value: string) {
    if (selectedFilter === value) {
      setSelectedFilter(null)
      loadRoutes()
      return
    }
    setSelectedFilter(value)
    if (filterType === 'region') loadRoutes({ region: value })
    if (filterType === 'series') loadRoutes({ tag: value })
  }

  const filterOptions = filterType === 'region' ? regions : filterType === 'series' ? seriesTags : []

  return (
    <div style={{ maxWidth: '680px', margin: '0 auto', minHeight: '100dvh', background: 'var(--surface)' }}>

      {/* 헤더 */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
          >←</button>
          <h1 style={{ fontSize: '16px', fontWeight: 900 }}>루트 둘러보기</h1>
        </div>

        {/* 필터 타입 선택 */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: filterType !== 'all' ? '10px' : 0 }}>
          {[
            { key: 'all', label: '전체' },
            { key: 'region', label: '📍 지역' },
            { key: 'series', label: '🎮 작품' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => handleFilterTypeChange(opt.key as FilterType)}
              style={{
                padding: '7px 14px', borderRadius: '20px',
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                background: filterType === opt.key ? 'var(--accent)' : 'var(--surface2)',
                color: filterType === opt.key ? '#fff' : 'var(--text)',
                fontWeight: 700, fontSize: '13px',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 세부 필터 옵션 */}
        {filterType !== 'all' && (
          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
            {filterOptions.map(opt => (
              <button
                key={opt}
                onClick={() => handleFilterSelect(opt)}
                style={{
                  padding: '6px 12px', borderRadius: '16px',
                  border: `1.5px solid ${selectedFilter === opt ? 'var(--accent)' : 'var(--border)'}`,
                  background: selectedFilter === opt ? 'var(--accent-l)' : 'var(--surface)',
                  color: selectedFilter === opt ? 'var(--accent)' : 'var(--text)',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                  whiteSpace: 'nowrap', flexShrink: 0, fontFamily: 'inherit',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 루트 목록 */}
      <div style={{ padding: '16px' }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 0', fontSize: '14px' }}>
            불러오는 중...
          </p>
        ) : routes.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--muted)', padding: '60px 0', fontSize: '14px' }}>
            조건에 맞는 루트가 없어요
          </p>
        ) : (
          routes.map(route => (
            <div
              key={route.id}
              onClick={() => router.push(`/route/${route.share_token}`)}
              style={{
                border: '1.5px solid var(--border)', borderRadius: '14px',
                padding: '16px', marginBottom: '12px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                {route.is_official && (
                  <span style={{
                    fontSize: '11px', fontWeight: 900, color: '#fff',
                    background: 'var(--accent)', borderRadius: '6px', padding: '2px 6px',
                  }}>공식</span>
                )}
                <h3 style={{ fontSize: '15px', fontWeight: 900 }}>{route.title}</h3>
              </div>

              {route.description && (
                <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>{route.description}</p>
              )}

              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                <span>❤️ {route.likes}</span>
                <span>📍 {route.route_shops?.length ?? 0}곳</span>
                <span>🚶 {route.total_duration_min}분</span>
                <span>📏 {formatDistance(route.total_distance_m)}</span>
              </div>

              <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                {route.profiles?.nickname ?? '익명'}님의 루트
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}