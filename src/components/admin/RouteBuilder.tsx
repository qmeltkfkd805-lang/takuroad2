'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { getAllTagsFull, AdminTag } from '@/services/workAdminService'
import { getShopsByTag } from '@/services/shopService'
import { createRoute } from '@/services/routeService'
import { approveOfficialRoute } from '@/services/adminRouteService'
import { shopRegion } from '@/lib/shop/quickCompleteness'
import { Shop } from '@/types/shop'

const DIFF = [{ v: 1, l: '🟢 쉬움' }, { v: 2, l: '🟡 보통' }, { v: 3, l: '🔴 오래걸림' }]

export default function RouteBuilder({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { user } = useAuth()
  const [tags, setTags] = useState<AdminTag[]>([])
  const [tagQuery, setTagQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<AdminTag | null>(null)
  const [candidates, setCandidates] = useState<Shop[]>([])
  const [loadingShops, setLoadingShops] = useState(false)
  const [region, setRegion] = useState('전체')
  const [added, setAdded] = useState<Shop[]>([])

  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [difficulty, setDifficulty] = useState(1)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { getAllTagsFull().then(setTags).catch(() => {}) }, [])

  async function pickTag(t: AdminTag) {
    setSelectedTag(t); setTagQuery(''); setRegion('전체'); setLoadingShops(true)
    if (!title) setTitle(`${t.name} 코스`)
    const shops = await getShopsByTag(t.slug).catch(() => [])
    setCandidates(shops.filter((s) => s.lat != null && s.lng != null))
    setLoadingShops(false)
  }

  const regions = useMemo(() => ['전체', ...Array.from(new Set(candidates.map((s) => shopRegion(s))))], [candidates])
  const filtered = useMemo(() => region === '전체' ? candidates : candidates.filter((s) => shopRegion(s) === region), [candidates, region])
  const addedIds = useMemo(() => new Set(added.map((s) => s.id)), [added])

  function add(s: Shop) { if (!addedIds.has(s.id)) setAdded((a) => [...a, s]) }
  function addAll() { setAdded((a) => { const ids = new Set(a.map((x) => x.id)); return [...a, ...filtered.filter((s) => !ids.has(s.id))] }) }
  function remove(id: string) { setAdded((a) => a.filter((s) => s.id !== id)) }
  function move(i: number, dir: -1 | 1) {
    setAdded((a) => {
      const j = i + dir
      if (j < 0 || j >= a.length) return a
      const copy = [...a]; [copy[i], copy[j]] = [copy[j], copy[i]]; return copy
    })
  }

  const tagMatches = tagQuery.trim() ? tags.filter((t) => t.name.includes(tagQuery.trim())).slice(0, 8) : []

  async function save() {
    if (!user) return
    if (!title.trim()) { setMsg('루트 이름을 입력하세요'); return }
    if (added.length < 2) { setMsg('샵을 2개 이상 담아주세요'); return }
    setSaving(true); setMsg(null)
    const res = await createRoute(user.id, title.trim(), desc.trim(), added.map((s) => ({ shopId: s.id, lat: s.lat as number, lng: s.lng as number })))
    if (!res) { setSaving(false); setMsg('루트 생성 실패'); return }
    const ok = await approveOfficialRoute(res.id, difficulty, user.id)
    setSaving(false)
    if (ok) { onDone() } else setMsg('공식 등록 실패 (루트는 생성됨)')
  }

  return (
    <div style={{ border: '1px solid var(--accent)', borderRadius: 14, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0 }}>새 공식 루트 만들기</h3>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>취소 ✕</button>
      </div>

      <Label>작품 선택</Label>
      {selectedTag ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 800 }}>🎬 {selectedTag.name}</span>
          <button onClick={() => { setSelectedTag(null); setCandidates([]) }} style={miniBtn}>변경</button>
        </div>
      ) : (
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input value={tagQuery} onChange={(e) => setTagQuery(e.target.value)} placeholder="작품 이름 검색" style={inp} />
          {tagMatches.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, marginTop: 4, overflow: 'hidden' }}>
              {tagMatches.map((t) => (
                <button key={t.id} onClick={() => pickTag(t)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, color: 'var(--text)' }}>{t.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedTag && (
        <>
          <Label>지역</Label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {regions.map((r) => (
              <button key={r} onClick={() => setRegion(r)} style={{ padding: '6px 11px', borderRadius: 9999, border: `1px solid ${region === r ? 'var(--accent)' : 'var(--border)'}`, background: region === r ? 'var(--accent)' : 'var(--surface)', color: region === r ? '#fff' : 'var(--muted)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{r}</button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{loadingShops ? '불러오는 중...' : `${filtered.length}개 샵`}</span>
            {filtered.length > 0 && <button onClick={addAll} style={miniBtn}>전체 담기</button>}
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 16 }}>
            {filtered.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{shopRegion(s)}</div>
                </div>
                <button onClick={() => add(s)} disabled={addedIds.has(s.id)} style={{ ...miniBtn, opacity: addedIds.has(s.id) ? 0.4 : 1 }}>{addedIds.has(s.id) ? '담김' : '담기'}</button>
              </div>
            ))}
            {!loadingShops && filtered.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>이 조건에 샵이 없어요</div>}
          </div>
        </>
      )}

      <Label>루트 순서 ({added.length})</Label>
      {added.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)', fontSize: 13, border: '1px dashed var(--border)', borderRadius: 10, marginBottom: 16 }}>위에서 샵을 담아주세요</div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          {added.map((s, i) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 4px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 22, height: 22, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
              <button onClick={() => move(i, -1)} disabled={i === 0} style={{ ...miniBtn, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
              <button onClick={() => move(i, 1)} disabled={i === added.length - 1} style={{ ...miniBtn, opacity: i === added.length - 1 ? 0.3 : 1 }}>↓</button>
              <button onClick={() => remove(s.id)} style={{ ...miniBtn, color: 'var(--red)' }}>✕</button>
            </div>
          ))}
        </div>
      )}

      <Label>루트 이름</Label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 홍대 원피스 굿즈 투어" style={{ ...inp, marginBottom: 10 }} />
      <Label>설명</Label>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="루트 소개 (선택)" style={{ ...inp, minHeight: 60, marginBottom: 10, resize: 'vertical' }} />
      <Label>난이도</Label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {DIFF.map((d) => (
          <button key={d.v} onClick={() => setDifficulty(d.v)} style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${difficulty === d.v ? 'var(--accent)' : 'var(--border)'}`, background: difficulty === d.v ? 'var(--accent)' : 'var(--surface)', color: difficulty === d.v ? '#fff' : 'var(--text)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{d.l}</button>
        ))}
      </div>

      <button onClick={save} disabled={saving} style={{ width: '100%', padding: 13, borderRadius: 10, border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' }}>
        {saving ? '저장 중...' : '공식 루트로 저장 (거리·시간 자동계산)'}
      </button>
      {msg && <p style={{ fontSize: 13, textAlign: 'center', marginTop: 10, color: 'var(--red)' }}>{msg}</p>}
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', fontFamily: 'inherit', fontSize: 14, background: 'var(--surface)', color: 'var(--text)' }
const miniBtn: React.CSSProperties = { padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }
function Label({ children }: { children: React.ReactNode }) { return <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--muted)', marginBottom: 6 }}>{children}</div> }
