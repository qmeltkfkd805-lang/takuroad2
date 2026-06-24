'use client'

import { useState, useEffect } from 'react'
import { getAllTagsForSelect } from '@/services/routeService'
import { searchPlace, PlaceSearchResult } from '@/lib/utils/geocode'

const EVENT_TYPES = [
  { value: 'popup', label: '🎪 팝업스토어' },
  { value: 'collab_cafe', label: '☕ 콜라보 카페' },
  { value: 'exhibition', label: '🖼️ 전시' },
]

interface Props {
  initialTagId?: string
  initialShopId?: string
}

export default function EventSubmitPage({ initialTagId, initialShopId }: Props) {
  const [title, setTitle] = useState('')
  const [tagId, setTagId] = useState(initialTagId ?? '')
  const [tagName, setTagName] = useState('')
  const [type, setType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [description, setDescription] = useState('')
  const [placeDetail, setPlaceDetail] = useState('')

  // 작품: 전체 불러와 입력값으로 필터
  const [allTags, setAllTags] = useState<{ id: string; name: string; slug: string }[]>([])
  useEffect(() => { getAllTagsForSelect().then(setAllTags) }, [])
  const [tagQuery, setTagQuery] = useState('')
  const tagResults = tagQuery.trim()
    ? allTags.filter(t => t.name.toLowerCase().includes(tagQuery.toLowerCase())).slice(0, 20)
    : []

  // 장소: 카카오 지도 키워드 검색 (샵 등록과 동일)
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [place, setPlace] = useState<PlaceSearchResult | null>(null)

  async function handlePlaceSearch() {
    if (!placeQuery.trim()) return
    setSearching(true)
    setPlaceResults(await searchPlace(placeQuery))
    setSearching(false)
  }

  const canSubmit = title && tagId && type && place && sourceUrl

  function handleSubmit() {
    const submission = {
      title, tag_id: tagId, type,
      place: place
        ? { name: place.name, address: place.roadAddress, lat: place.lat, lng: place.lng, detail: placeDetail || null }
        : null,
      start_date: startDate || null, end_date: endDate || null,
      source_url: sourceUrl, description: description || null,
    }
    console.log('[이벤트 제보]', submission)
    alert('제보 내용이 콘솔에 출력되었어요 (아직 저장은 안 됨)')
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', padding: '16px', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text)', margin: '4px 0 20px' }}>
        🎪 이벤트 제보하기
      </h1>

      <Field label="이벤트명 *">
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="예: 블루아카이브 × 애니메이트 콜라보 카페" style={inputStyle} />
      </Field>

      {/* 작품 — 우리 DB 검색-선택 */}
      <Field label="작품 *">
        {tagName ? (
          <Selected icon="🎮" label={tagName} onClear={() => { setTagId(''); setTagName('') }} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={tagQuery} onChange={e => setTagQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
                placeholder="작품 이름으로 검색 (예: 블루아카이브)" style={{ ...inputStyle, flex: 1 }} />
              <button disabled={!tagQuery.trim()}
                style={{ padding: '0 16px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                검색
              </button>
            </div>
            {tagResults.length > 0 && (
              <ResultBox>
                {tagResults.map(t => (
                  <ResultRow key={t.id} onClick={() => { setTagId(t.id); setTagName(t.name); setTagQuery('') }}>
                    🎮 {t.name}
                  </ResultRow>
                ))}
              </ResultBox>
            )}
          </>
        )}
      </Field>

      <Field label="종류 *">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {EVENT_TYPES.map(et => (
            <button key={et.value} onClick={() => setType(et.value)}
              style={{
                padding: '10px 14px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
                border: `1.5px solid ${type === et.value ? 'var(--accent)' : 'var(--border)'}`,
                background: type === et.value ? 'var(--surface2)' : 'var(--surface)',
                color: 'var(--text)', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
              }}>
              {et.label}
            </button>
          ))}
        </div>
      </Field>

      {/* 장소 — 카카오 지도 검색 (샵 등록과 동일) */}
      <Field label="장소 *">
        {place ? (
          <Selected icon="📍" label={`${place.name} · ${place.roadAddress}`}
            onClear={() => { setPlace(null); setPlaceQuery(''); setPlaceResults([]) }} />
        ) : (
          <>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input value={placeQuery} onChange={e => setPlaceQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handlePlaceSearch() } }}
                placeholder="예: 애니메이트 홍대, 더현대 서울" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={handlePlaceSearch} disabled={searching || !placeQuery.trim()}
                style={{ padding: '0 16px', borderRadius: 'var(--r-sm)', border: 'none',
                  background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '13px',
                  cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                {searching ? '검색중' : '검색'}
              </button>
            </div>
            {placeResults.length > 0 && (
              <ResultBox>
                {placeResults.map((p, i) => (
                  <ResultRow key={i} onClick={() => { setPlace(p); setPlaceResults([]) }}>
                    <div style={{ fontSize: '14px', fontWeight: 700 }}>📍 {p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.roadAddress}</div>
                  </ResultRow>
                ))}
              </ResultBox>
            )}
          </>
        )}
      </Field>

      <Field label="상세 위치">
        <input value={placeDetail} onChange={e => setPlaceDetail(e.target.value)}
          placeholder="예: 5층, 지하 1층 B구역" style={inputStyle} />
      </Field>

      <Field label="기간">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
          <span style={{ color: 'var(--muted)' }}>~</span>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={inputStyle} />
        </div>
      </Field>

      <Field label="출처 (URL) *">
        <input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)}
          placeholder="공식 X, 인스타그램, 홈페이지 링크" style={inputStyle} />
      </Field>

      <Field label="설명">
        <textarea value={description} onChange={e => setDescription(e.target.value)}
          placeholder="한두 줄로 간단히" rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
      </Field>

      <button onClick={handleSubmit} disabled={!canSubmit}
        style={{
          width: '100%', padding: '14px', borderRadius: 'var(--r-sm)', border: 'none',
          background: canSubmit ? 'var(--accent)' : 'var(--border)',
          color: '#fff', fontSize: '15px', fontWeight: 700, marginTop: '12px',
          cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
        }}>
        제보하기
      </button>
    </div>
  )
}

function Selected({ icon, label, onClear }: { icon: string; label: string; onClear: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ flex: 1, padding: '11px 14px', borderRadius: 'var(--r-sm)',
        background: 'var(--surface2)', fontSize: '14px', fontWeight: 700 }}>
        {icon} {label}
      </span>
      <button onClick={onClear}
        style={{ ...inputStyle, width: 'auto', padding: '11px 14px', cursor: 'pointer' }}>변경</button>
    </div>
  )
}

function ResultBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ marginTop: '6px', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function ResultRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClick} style={{ padding: '11px 14px', cursor: 'pointer',
      borderBottom: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)' }}>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 'var(--r-sm)',
  border: '1px solid var(--border)', background: 'var(--surface)',
  fontSize: '14px', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box',
}