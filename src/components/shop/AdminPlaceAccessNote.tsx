'use client'
import AppIcon from '@/components/tds/AppIcon'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * 관리자 전용 — 건물(place)의 '가는 길/출구 안내' 편집.
 * 같은 건물의 모든 샵이 공유한다. 샵이 place에 연결돼 있을 때만 노출.
 */
export default function AdminPlaceAccessNote({ placeId, placeName }: { placeId: string; placeName: string | null }) {
  const [note, setNote] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    createClient().from('places').select('access_note').eq('id', placeId).maybeSingle()
      .then(({ data }) => { if (!cancelled) { setNote((data as any)?.access_note ?? ''); setLoaded(true) } })
    return () => { cancelled = true }
  }, [placeId])

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/place-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId, accessNote: note }),
      })
      const j = await res.json()
      setMsg(res.ok ? '저장했어요' : (j.error || '저장 실패'))
    } catch { setMsg('저장 실패') }
    setSaving(false)
  }

  return (
    <div style={{ marginTop: 10, padding: 14, border: '1px dashed var(--border)', borderRadius: 12, background: 'var(--surface2)' }}>
      <div style={{ fontSize: 13, fontWeight: 800 }}>
        <AppIcon name="pin" size={13} style={{ marginRight: 4, verticalAlign: '-2px' }} />가는 길/출구 안내 (관리자)
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 8px' }}>
        {placeName ?? '이 건물'}의 모든 샵이 공유해요. 예: 수원역 4번 출구 도보 2분, 지하상가 경유가 더 빠름
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        disabled={!loaded}
        placeholder={loaded ? '가는 길·출구 안내를 입력하세요' : '불러오는 중…'}
        rows={2}
        style={{ width: '100%', padding: '9px 11px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 13, resize: 'vertical' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <button onClick={save} disabled={saving || !loaded}
          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
          {saving ? '저장 중…' : '안내 저장'}
        </button>
        {msg && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{msg}</span>}
      </div>
    </div>
  )
}
