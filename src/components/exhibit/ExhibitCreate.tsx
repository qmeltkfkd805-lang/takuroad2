'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoodsPageShell from '@/components/goods/GoodsPageShell'
import { getMyExhibitPostChoices, addExhibitEntry, type ExhibitPostChoice } from '@/services/exhibitService'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

/* 전시관에 추가 (/profile/exhibit/new)
   내가 쓴 굿즈 글을 고르고 "전시관에 추가"를 누르면 끝.
   - 사진·본문·공개범위는 원본 글을 그대로 쓴다(별도 입력 없음)
   - 이미 전시 중인 글은 "전시 중"으로 표시하고 고를 수 없다(DB unique 로도 중복 차단) */
export default function ExhibitCreate() {
  const router = useRouter()
  const [posts, setPosts] = useState<ExhibitPostChoice[] | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getMyExhibitPostChoices().then(setPosts).catch(() => { setLoadErr(true); setPosts([]) })
  }, [])

  function toggle(p: ExhibitPostChoice) {
    if (p.entryId || saving) return
    setPicked(prev => prev.includes(p.postId) ? prev.filter(x => x !== p.postId) : [...prev, p.postId])
  }

  async function submit() {
    if (!picked.length) return
    setSaving(true); setErr(null)
    const done: string[] = []
    try {
      for (const pid of picked) {
        await addExhibitEntry(pid)
        done.push(pid)
      }
      router.replace('/profile/exhibit')
    } catch (e: any) {
      // 일부만 추가됐으면 그만큼 "전시 중"으로 반영하고 나머지만 남긴다
      if (done.length) {
        setPosts(prev => prev?.map(p => done.includes(p.postId) ? { ...p, entryId: p.entryId ?? 'added' } : p) ?? prev)
        setPicked(prev => prev.filter(x => !done.includes(x)))
      }
      setErr(e?.message ?? '전시관에 추가하지 못했어요')
      setSaving(false)
    }
  }

  const available = (posts ?? []).filter(p => !p.entryId).length

  return (
    <GoodsPageShell
      crumbs={[{ label: '마이', href: '/profile' }, { label: '전시관', href: '/profile/exhibit' }, { label: '전시관에 추가' }]}
      title="전시관에 추가"
    >
      <p style={{ fontSize: 15, color: 'var(--muted)', margin: '2px 0 22px', lineHeight: 1.6 }}>
        내가 쓴 굿즈 글을 골라 전시관에 걸어보세요. 사진과 본문, 공개 범위는 원본 글을 그대로 따라요.
      </p>

      {posts === null ? (
        <div style={gridStyle}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map(i => <div key={i} style={{ aspectRatio: '1/1.25', borderRadius: 16, background: 'var(--surface2)' }} />)}
        </div>
      ) : loadErr ? (
        <div style={{ padding: 56, textAlign: 'center', color: 'var(--muted)', fontSize: 15 }}>내 굿즈 글을 불러오지 못했어요. 잠시 후 다시 시도해주세요.</div>
      ) : posts.length === 0 ? (
        <div style={{ padding: '64px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>아직 쓴 굿즈 글이 없어요</div>
          <p style={{ fontSize: 15, color: 'var(--muted)', margin: '0 0 20px' }}>굿즈 자랑 글을 쓰면 여기서 전시관에 걸 수 있어요.</p>
          <button onClick={() => router.push('/community/write?board=goods')} style={btnPrimary}>굿즈 글 쓰기</button>
        </div>
      ) : (
        <>
          <div style={gridStyle}>
            {posts.map(p => {
              const on = picked.includes(p.postId)
              const shown = !!p.entryId
              const label = (p.title && p.title.trim()) || (p.excerpt && p.excerpt.trim()) || '(제목 없음)'
              return (
                <button key={p.postId} onClick={() => toggle(p)} disabled={shown || saving} aria-pressed={on}
                  style={{
                    display: 'block', padding: 0, textAlign: 'left', fontFamily: 'inherit', overflow: 'hidden',
                    borderRadius: 16, background: 'var(--surface)',
                    border: on ? '3px solid var(--accent, #ff5692)' : '1px solid var(--border)',
                    cursor: shown ? 'default' : 'pointer', opacity: shown ? 0.62 : 1,
                  }}>
                  <span style={{ display: 'block', position: 'relative', aspectRatio: '1/1', background: 'var(--surface2)' }}>
                    {p.coverUrl
                      ? <img src={p.coverUrl} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13.5 }}>사진 없는 글</span>}
                    {shown && <span style={{ ...chip, background: 'rgba(0,0,0,.66)' }}>전시 중</span>}
                    {!shown && on && (
                      <span style={{ ...chip, background: 'var(--accent)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-10" /></svg>선택
                      </span>
                    )}
                    {p.imageCount > 1 && (
                      <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.55)', color: '#fff', fontSize: 12.5, fontWeight: 800, padding: '3px 9px', borderRadius: 9999 }}>{p.imageCount}장</span>
                    )}
                  </span>
                  <span style={{ display: 'block', padding: '12px 14px 14px' }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, fontSize: 13, color: 'var(--muted)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{p.workName ?? '작품 미지정'}</span>
                      {p.visibility === 'private' && <span style={{ flexShrink: 0, fontWeight: 700 }}>· 나만 보기</span>}
                      <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{fmtDate(p.createdAt)}</span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {available === 0 && (
            <p style={{ fontSize: 14.5, color: 'var(--muted)', margin: '20px 0 0' }}>모든 굿즈 글이 이미 전시 중이에요.</p>
          )}

          {/* 하단 고정 바 */}
          <div style={{ position: 'sticky', bottom: 0, marginTop: 24, padding: '16px 0', background: 'var(--bg, var(--surface))', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', zIndex: 5 }}>
            <span style={{ fontSize: 15, color: 'var(--muted)', fontWeight: 700 }}>
              {picked.length ? `${picked.length}개 선택` : '전시할 글을 골라주세요'}
            </span>
            {err && <span style={{ color: '#e5484d', fontSize: 14 }}>{err}</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => router.push('/profile/exhibit')} disabled={saving} style={btnGhost}>취소</button>
              <button onClick={submit} disabled={saving || picked.length === 0} style={{ ...btnPrimary, opacity: (saving || picked.length === 0) ? 0.55 : 1 }}>
                {saving ? '추가하는 중…' : '전시관에 추가'}
              </button>
            </span>
          </div>
        </>
      )}
    </GoodsPageShell>
  )
}

function fmtDate(s?: string) {
  if (!s) return ''
  try { const d = new Date(s); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}` } catch { return '' }
}

const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 18 }
const chip: React.CSSProperties = { position: 'absolute', top: 10, left: 10, color: '#fff', fontSize: 13, fontWeight: 800, padding: '4px 11px', borderRadius: 9999 }
const btnPrimary: React.CSSProperties = { height: 48, padding: '0 24px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 800, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { height: 48, padding: '0 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 15.5, fontWeight: 800, cursor: 'pointer' }
