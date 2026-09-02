'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoodsPageShell from '@/components/goods/GoodsPageShell'
import { getGoodsDetail, type GoodsImageDetail } from '@/services/goodsService'
import {
  getExhibitManage, updateExhibit, addExhibitImages, removeExhibitImage, reorderExhibitImages,
  type ExhibitManage, type ExhibitVisibility,
} from '@/services/exhibitService'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const VIS: { key: ExhibitVisibility; label: string }[] = [
  { key: 'public', label: '전체 공개' }, { key: 'followers', label: '팔로워' }, { key: 'private', label: '나만' },
]

/* 전시 편집(소유자 전용) — 사진 추가/삭제/순서/대표는 즉시 반영, 캡션·공개범위·원본글은 저장 버튼. */
export default function ExhibitEditView({ id }: { id: string }) {
  const router = useRouter()
  const [data, setData] = useState<ExhibitManage | null | 'notfound'>(null)
  const [imgs, setImgs] = useState<{ id: string; url: string }[]>([])
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<ExhibitVisibility>('public')
  const [sourcePostId, setSourcePostId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // 사진 추가 패널
  const [adding, setAdding] = useState(false)
  const [goodsImgs, setGoodsImgs] = useState<GoodsImageDetail[] | null>(null)
  const [pick, setPick] = useState<string[]>([])

  async function load() {
    try {
      const d = await getExhibitManage(id)
      if (!d) { setData('notfound'); return }
      setData(d); setImgs(d.images)
      setCaption(d.caption ?? ''); setVisibility(d.visibility); setSourcePostId(d.sourcePostId)
    } catch { setData('notfound') }
  }
  useEffect(() => { load()   }, [id])

  function flash(m: string) { setMsg(m); setTimeout(() => setMsg(null), 1800) }

  async function doReorder(next: { id: string; url: string }[]) {
    const prev = imgs
    setImgs(next); setBusy(true); setErr(null)
    try { await reorderExhibitImages(id, next.map(i => i.id)); flash('순서를 저장했어요') }
    catch (e: any) { setImgs(prev); setErr(e?.message ?? '순서 변경 실패') }
    finally { setBusy(false) }
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir
    if (j < 0 || j >= imgs.length) return
    const next = imgs.slice(); [next[i], next[j]] = [next[j], next[i]]; doReorder(next)
  }
  function makeCover(i: number) {
    if (i === 0) return
    const next = imgs.slice(); const [it] = next.splice(i, 1); next.unshift(it); doReorder(next)
  }
  async function removeImg(imageId: string) {
    if (imgs.length <= 1) { setErr('최소 1장은 있어야 해요'); return }
    if (!window.confirm('이 사진을 전시에서 뺄까요?')) return
    setBusy(true); setErr(null)
    try { await removeExhibitImage(id, imageId); await load(); flash('사진을 뺐어요') }
    catch (e: any) { setErr(e?.message ?? '삭제 실패') }
    finally { setBusy(false) }
  }

  async function openAdd() {
    if (data === null || data === 'notfound') return
    setAdding(true); setPick([]); setGoodsImgs(null); setErr(null)
    try {
      const d = await getGoodsDetail(data.goodsItemId)
      setGoodsImgs((d?.images ?? []).filter(im => im.url && im.path && !im.external))
    } catch { setGoodsImgs([]) }
  }
  function togglePick(imageId: string) {
    setPick(prev => prev.includes(imageId) ? prev.filter(x => x !== imageId)
      : (imgs.length + prev.length >= 10 ? prev : [...prev, imageId]))
  }
  async function confirmAdd() {
    if (!pick.length) { setAdding(false); return }
    setBusy(true); setErr(null)
    try { await addExhibitImages(id, pick); setAdding(false); await load(); flash('사진을 추가했어요') }
    catch (e: any) { setErr(e?.message ?? '사진 추가 실패') }
    finally { setBusy(false) }
  }

  async function save() {
    setSaving(true); setErr(null)
    try { await updateExhibit(id, { caption: caption.trim() || null, visibility, sourcePostId }); flash('저장했어요') }
    catch (e: any) { setErr(e?.message ?? '저장 실패') }
    finally { setSaving(false) }
  }

  const shell = (children: React.ReactNode) => (
    <GoodsPageShell crumbs={[{ label: '마이', href: '/profile' }, { label: '전시관', href: '/profile/exhibit' }, { label: '전시 편집' }]} title="전시 편집">
      {children}
    </GoodsPageShell>
  )

  if (data === null) return shell(<div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>불러오는 중…</div>)
  if (data === 'notfound') return shell(
    <div style={{ padding: 48, textAlign: 'center' }}>
      <p style={{ margin: '0 0 16px', color: 'var(--muted)' }}>편집할 수 없는 전시예요.</p>
      <button onClick={() => router.push('/profile/exhibit')} style={btnGhost}>전시관으로</button>
    </div>
  )

  const canAddMore = imgs.length < 10

  return shell(
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {data.workName && <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)', border: '1px solid var(--accent, #ff5692)', padding: '3px 10px', borderRadius: 9999 }}>{data.workName}</span>}
        {data.goodsName && <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{data.goodsName}</span>}
      </div>

      {/* 사진 관리 */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>사진 <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({imgs.length}/10 · 맨 앞이 대표)</span></div>
        <button onClick={openAdd} disabled={busy || !canAddMore} style={{ ...miniBtn, opacity: (busy || !canAddMore) ? 0.5 : 1 }}>+ 사진 추가</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
        {imgs.map((im, i) => (
          <div key={im.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', border: i === 0 ? '2px solid var(--accent, #ff5692)' : '1px solid var(--border)', background: 'var(--surface2)' }}>
            <img src={im.url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            {i === 0 && <span style={{ position: 'absolute', top: 6, left: 6, background: 'var(--accent)', color: '#fff', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 9999 }}>대표</span>}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', gap: 2, padding: 4, background: 'linear-gradient(transparent, rgba(0,0,0,.5))' }}>
              <button onClick={() => move(i, -1)} disabled={busy || i === 0} aria-label="앞으로" style={imgBtn(i === 0)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg></button>
              <button onClick={() => move(i, 1)} disabled={busy || i === imgs.length - 1} aria-label="뒤로" style={imgBtn(i === imgs.length - 1)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg></button>
              {i !== 0 && <button onClick={() => makeCover(i)} disabled={busy} aria-label="대표로" style={{ ...imgBtn(false), flex: 1, fontSize: 11, fontWeight: 800, color: '#fff' }}>대표</button>}
              <button onClick={() => removeImg(im.id)} disabled={busy || imgs.length <= 1} aria-label="삭제" style={imgBtn(imgs.length <= 1)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg></button>
            </div>
          </div>
        ))}
      </div>

      {/* 전시글 */}
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>전시글 <span style={{ color: 'var(--muted)', fontWeight: 600 }}>(선택, 최대 500자)</span></div>
      <textarea value={caption} onChange={e => setCaption(e.target.value.slice(0, 500))} rows={3} placeholder="이 굿즈에 대한 짧은 소개를 남겨보세요"
        style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 18 }} />

      {/* 공개범위 */}
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>공개범위</div>
      <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, marginBottom: 18 }}>
        {VIS.map(v => (
          <button key={v.key} onClick={() => setVisibility(v.key)} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: visibility === v.key ? 'var(--surface)' : 'none', color: visibility === v.key ? 'var(--accent)' : 'var(--muted)', boxShadow: visibility === v.key ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{v.label}</button>
        ))}
      </div>

      {/* 원본 글 연결 */}
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>원본 굿즈 자랑 글 <span style={{ color: 'var(--muted)', fontWeight: 600 }}>(선택)</span></div>
      {data.postOptions.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 22px' }}>이 굿즈로 쓴 자랑 글이 없어요. 글을 쓰면 여기서 연결할 수 있어요.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 }}>
          <label style={rowOpt(sourcePostId === null)}>
            <input type="radio" name="srcpost" checked={sourcePostId === null} onChange={() => setSourcePostId(null)} />
            <span style={{ fontSize: 13.5, color: 'var(--text)' }}>연결 안 함</span>
          </label>
          {data.postOptions.map(p => (
            <label key={p.id} style={rowOpt(sourcePostId === p.id)}>
              <input type="radio" name="srcpost" checked={sourcePostId === p.id} onChange={() => setSourcePostId(p.id)} />
              <span style={{ fontSize: 13.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
            </label>
          ))}
        </div>
      )}

      {err && <div style={{ color: '#e5484d', fontSize: 13, marginBottom: 12 }}>{err}</div>}
      {msg && <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 12 }}>{msg}</div>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => router.push(`/profile/exhibit/${id}`)} disabled={saving || busy} style={btnGhost}>닫기</button>
        <button onClick={save} disabled={saving || busy} style={{ ...btnPrimary, opacity: (saving || busy) ? 0.6 : 1 }}>{saving ? '저장 중…' : '저장'}</button>
      </div>

      {/* 사진 추가 모달 */}
      {adding && (
        <div onClick={() => !busy && setAdding(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 800 }}>사진 추가 <span style={{ color: 'var(--muted)', fontWeight: 600, fontSize: 13 }}>({imgs.length + pick.length}/10)</span></div>
              <button onClick={() => setAdding(false)} disabled={busy} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, padding: 0, lineHeight: 1 }}>×</button>
            </div>
            {goodsImgs === null ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>사진 불러오는 중…</div>
            ) : goodsImgs.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>추가할 수 있는 굿즈 사진이 없어요.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(88px,1fr))', gap: 8, marginBottom: 16 }}>
                {goodsImgs.map(im => {
                  const on = pick.includes(im.id)
                  return (
                    <button key={im.id} onClick={() => togglePick(im.id)} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', border: on ? '2px solid var(--accent, #ff5692)' : '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', padding: 0 }}>
                      {im.url && <img src={im.url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                      {on && <span style={{ position: 'absolute', top: 5, left: 5, width: 20, height: 20, borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setAdding(false)} disabled={busy} style={btnGhost}>취소</button>
              <button onClick={confirmAdd} disabled={busy || !pick.length} style={{ ...btnPrimary, opacity: (busy || !pick.length) ? 0.6 : 1 }}>{busy ? '추가 중…' : `추가 (${pick.length})`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function imgBtn(disabled: boolean): React.CSSProperties {
  return { flex: '0 0 auto', minWidth: 26, height: 26, borderRadius: 7, border: 'none', background: 'rgba(0,0,0,.45)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }
}
function rowOpt(on: boolean): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, border: `1px solid ${on ? 'var(--accent, #ff5692)' : 'var(--border)'}`, background: 'var(--surface)', cursor: 'pointer' }
}
const btnPrimary: React.CSSProperties = { height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { height: 44, padding: '0 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }
const miniBtn: React.CSSProperties = { height: 34, padding: '0 13px', borderRadius: 9999, border: '1px solid var(--accent, #ff5692)', background: 'var(--surface)', color: 'var(--accent)', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer' }
