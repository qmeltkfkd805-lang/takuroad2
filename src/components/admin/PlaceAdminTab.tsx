'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/* 장소(Place) 관리 — 대표 이미지가 컬렉션 카드의 얼굴이 된다.
   Place는 수가 적어서(스타필드·코엑스·DDP…) 운영자가 직접 관리해도 부담이 없다. */

interface Place {
  id: string
  name: string
  slug: string
  place_type: string | null
  addr: string | null
  cover_image: string | null
}

const MAX_MB = 5

async function uploadPlaceCover(file: File): Promise<{ url: string | null; error: string | null }> {
  if (file.size > MAX_MB * 1024 * 1024) return { url: null, error: `사진은 ${MAX_MB}MB 이하만 올릴 수 있어요.` }

  const supabase = createClient()
  const mime = file.type.split('/')[1]
  const ext = mime && /^[a-z0-9]+$/i.test(mime) ? (mime === 'jpeg' ? 'jpg' : mime) : 'jpg'
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `covers/${rand}.${ext}`

  const { error } = await supabase.storage.from('places').upload(path, file)
  if (error) {
    console.error('[Place 커버 업로드 실패]', error.message)
    return { url: null, error: error.message }
  }
  const { data } = supabase.storage.from('places').getPublicUrl(path)
  return { url: data.publicUrl, error: null }
}

async function saveCover(id: string, coverImage: string | null): Promise<string | null> {
  const res = await fetch('/api/admin/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ table: 'places', id, fields: { cover_image: coverImage } }),
  })
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    return j.error ?? '저장에 실패했어요'
  }
  return null
}

export default function PlaceAdminTab() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = async () => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('places')
      .select('id, name, slug, place_type, addr, cover_image')
      .order('name')
    if (error) console.error('[Place 목록]', error.message)
    setPlaces((data ?? []) as Place[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toast = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2600) }

  const onPick = async (place: Place, file: File) => {
    setBusyId(place.id)
    const { url, error } = await uploadPlaceCover(file)
    if (!url) { toast(error ?? '업로드 실패'); setBusyId(null); return }
    const saveErr = await saveCover(place.id, url)
    if (saveErr) { toast(saveErr); setBusyId(null); return }
    setPlaces(ps => ps.map(p => (p.id === place.id ? { ...p, cover_image: url } : p)))
    toast(`${place.name} 대표 이미지 저장 완료`)
    setBusyId(null)
  }

  const onRemove = async (place: Place) => {
    if (!confirm(`${place.name}의 대표 이미지를 지울까요?`)) return
    setBusyId(place.id)
    const err = await saveCover(place.id, null)
    if (err) { toast(err); setBusyId(null); return }
    setPlaces(ps => ps.map(p => (p.id === place.id ? { ...p, cover_image: null } : p)))
    toast('대표 이미지를 지웠어요')
    setBusyId(null)
  }

  const list = q.trim()
    ? places.filter(p => (p.name + (p.addr ?? '')).toLowerCase().includes(q.trim().toLowerCase()))
    : places

  const withCover = places.filter(p => p.cover_image).length

  if (loading) return <p style={{ color: '#7A7A7A' }}>불러오는 중…</p>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900 }}>장소(Place) 관리</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#7A7A7A' }}>
            대표 이미지는 <b>컬렉션 카드의 얼굴</b>이에요. 가로로 넓은 사진이 좋아요 (16:11)
          </p>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: '#7A7A7A' }}>
          이미지 있음 <b style={{ color: '#FF5692' }}>{withCover}</b> / {places.length}
        </span>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="장소 이름·주소 검색"
        style={{
          width: '100%', maxWidth: 340, padding: '10px 14px', marginBottom: 16,
          border: '1px solid #ECEBE1', borderRadius: 9999, fontFamily: 'inherit', fontSize: 14,
        }}
      />

      {list.length === 0 ? (
        <p style={{ color: '#7A7A7A' }}>장소가 없어요.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
          {list.map(p => (
            <PlaceCard
              key={p.id}
              place={p}
              busy={busyId === p.id}
              onPick={f => onPick(p, f)}
              onRemove={() => onRemove(p)}
            />
          ))}
        </div>
      )}

      {msg && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 50,
          padding: '11px 20px', borderRadius: 12, background: '#20202D', color: '#fff',
          fontSize: 13, fontWeight: 700, boxShadow: '0 8px 22px rgba(0,0,0,.2)',
        }}>{msg}</div>
      )}
    </div>
  )
}

function PlaceCard({ place, busy, onPick, onRemove }: {
  place: Place; busy: boolean; onPick: (f: File) => void; onRemove: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)

  return (
    <div style={{ border: '1px solid #ECEBE1', borderRadius: 16, overflow: 'hidden', background: '#fff' }}>
      <div
        onClick={() => !busy && ref.current?.click()}
        style={{
          position: 'relative', aspectRatio: '16 / 11', cursor: busy ? 'wait' : 'pointer',
          background: place.cover_image ? '#FBF6EE' : 'linear-gradient(135deg, #FFE3EE, #FFF3D6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {place.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={place.cover_image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: 13, fontWeight: 800, color: '#C2416C' }}>
            {busy ? '올리는 중…' : '클릭해서 이미지 추가'}
          </span>
        )}
        {busy && place.cover_image && (
          <span style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#FF5692',
          }}>올리는 중…</span>
        )}
      </div>

      <input
        ref={ref}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onPick(f)
          e.target.value = ''
        }}
      />

      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 2 }}>{place.name}</div>
        <div style={{ fontSize: 12, color: '#7A7A7A', marginBottom: 10 }}>{place.addr ?? '주소 없음'}</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => ref.current?.click()}
            disabled={busy}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 9999, border: '1px solid #FF5692',
              background: '#fff', color: '#FF5692', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            {place.cover_image ? '이미지 교체' : '이미지 추가'}
          </button>
          {place.cover_image && (
            <button
              onClick={onRemove}
              disabled={busy}
              style={{
                padding: '8px 14px', borderRadius: 9999, border: '1px solid #ECEBE1',
                background: '#fff', color: '#7A7A7A', fontFamily: 'inherit',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
              }}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
