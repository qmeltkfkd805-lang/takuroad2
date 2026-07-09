'use client'

import { useState } from 'react'
import { searchPlace, PlaceSearchResult } from '@/lib/utils/geocode'
import { mapAddrToPlace } from '@/services/placeService'
import { regionFromAddr, districtFromAddr } from '@/lib/utils/region'

/**
 * 관리자가 "이 주소 = 이 장소"를 학습시키는 UI.
 * 샵 편집 화면에서만, isAdmin일 때만 뜬다.
 * 한 번 매핑하면 같은 주소의 샵·이벤트가 이후 자동 연결된다.
 */
export default function AdminPlaceLink({
  shopAddr, currentPlaceName, onLinked,
}: {
  shopAddr: string
  currentPlaceName: string | null
  onLinked: (place: { id: string; name: string; slug: string }) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)

  async function doSearch() {
    if (!query.trim()) return
    setSearching(true)
    setResults(await searchPlace(query))
    setSearching(false)
  }

  async function link(place: PlaceSearchResult) {
    setSaving(true)
    const result = await mapAddrToPlace({
      addr: shopAddr,
      kakaoPlaceId: place.kakaoPlaceId,
      name: place.name,
      placeAddr: place.roadAddress || place.address,
      region: regionFromAddr(place.roadAddress || place.address),
      district: districtFromAddr(place.roadAddress || place.address),
      lat: place.lat,
      lng: place.lng,
      categoryName: place.categoryName,
      categoryGroupCode: place.categoryGroupCode,
    })
    setSaving(false)
    if (result) {
      onLinked(result)
      setOpen(false)
      setQuery('')
      setResults([])
    }
  }

  return (
    <div style={{ marginTop: 14, padding: 14, border: '1px dashed var(--border)', borderRadius: 12, background: 'var(--surface2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800 }}>🛠 소속 장소 (관리자)</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            현재: {currentPlaceName ?? '없음 (독립 매장)'}
          </div>
        </div>
        {!open && (
          <button onClick={() => setOpen(true)} style={btnStyle}>장소 연결하기</button>
        )}
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doSearch() } }}
              placeholder="장소 검색 (예: 스타필드 수원)"
              style={{ flex: 1, padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13 }}
            />
            <button onClick={doSearch} disabled={searching || !query.trim()} style={btnStyle}>
              {searching ? '검색…' : '검색'}
            </button>
          </div>

          {results.length > 0 && (
            <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
              {results.map((p, i) => (
                <div key={i} style={{ padding: '10px 12px', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--muted)', marginBottom: 6 }}>{p.roadAddress || p.address}</div>
                  <button onClick={() => link(p)} disabled={saving} style={{ ...btnStyle, fontSize: 12, padding: '6px 12px' }}>
                    {saving ? '연결 중…' : `이 주소를 ${p.name}에 매핑`}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
            연결하면 <b>{shopAddr}</b> 주소의 샵·이벤트가 이후 자동으로 이 장소에 묶여요.
          </p>
          <button onClick={() => setOpen(false)} style={{ ...btnStyle, background: 'none', color: 'var(--muted)', border: '1px solid var(--border)', marginTop: 4 }}>
            닫기
          </button>
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 8, border: 'none',
  background: 'var(--accent)', color: '#fff',
  fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
}
