'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import GoodsPageShell from '@/components/goods/GoodsPageShell'
import { getMyGoods, getGoodsDetail, type GoodsListItem, type GoodsImageDetail } from '@/services/goodsService'
import { createExhibit, type ExhibitVisibility } from '@/services/exhibitService'

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const VIS: { key: ExhibitVisibility; label: string }[] = [
  { key: 'public', label: '전체 공개' }, { key: 'followers', label: '팔로워' }, { key: 'private', label: '나만' },
]

export default function ExhibitCreate() {
  const router = useRouter()
  const [step, setStep] = useState<'goods' | 'compose'>('goods')

  // 굿즈 선택
  const [goods, setGoods] = useState<GoodsListItem[] | null>(null)
  const [picked, setPicked] = useState<GoodsListItem | null>(null)

  // 사진/폼
  const [images, setImages] = useState<GoodsImageDetail[] | null>(null)
  const [order, setOrder] = useState<string[]>([])   // 선택된 image id 순서(첫=대표)
  const [caption, setCaption] = useState('')
  const [visibility, setVisibility] = useState<ExhibitVisibility>('public')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    getMyGoods({ limit: 60 }).then(r => setGoods(r.items)).catch(() => setGoods([]))
  }, [])

  async function choose(g: GoodsListItem) {
    setPicked(g); setStep('compose'); setImages(null); setOrder([]); setErr(null)
    try {
      const d = await getGoodsDetail(g.id)
      const imgs = (d?.images ?? []).filter(im => im.url)
      setImages(imgs)
      if (imgs[0]) setOrder([imgs[0].id])   // 기본 대표 = 첫 사진
    } catch { setImages([]) }
  }

  function toggle(id: string) {
    setOrder(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 10) return prev
      return [...prev, id]
    })
  }

  async function submit() {
    if (!picked || order.length < 1) return
    setSaving(true); setErr(null)
    try {
      const id = await createExhibit({
        goodsItemId: picked.id,
        imageIds: order,
        caption: caption.trim() || null,
        visibility,
      })
      router.replace('/profile/exhibit')
      void id
    } catch (e: any) {
      setErr(e?.message ?? '전시 등록에 실패했어요'); setSaving(false)
    }
  }

  return (
    <GoodsPageShell
      crumbs={[{ label: '마이', href: '/profile' }, { label: '전시관', href: '/profile/exhibit' }, { label: '굿즈 전시하기' }]}
      title="굿즈 전시하기"
    >
      {step === 'goods' && (
        <div style={{ maxWidth: 760 }}>
          <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '2px 0 14px' }}>전시할 굿즈를 하나 골라주세요. 다음 단계에서 사진과 공개범위를 정합니다.</p>
          {goods === null ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
              {[0, 1, 2, 3, 4, 5].map(i => <div key={i} style={{ aspectRatio: '1/1', borderRadius: 12, background: 'var(--surface2)' }} />)}
            </div>
          ) : goods.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              <p style={{ marginBottom: 14 }}>전시할 굿즈가 아직 없어요.</p>
              <button onClick={() => router.push('/community/write?board=goods')} style={btnPrimary}>굿즈 올리기</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 10 }}>
              {goods.map(g => (
                <button key={g.id} onClick={() => choose(g)} style={{ display: 'block', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface)', cursor: 'pointer', padding: 0, fontFamily: 'inherit', textAlign: 'left' }}>
                  <span style={{ display: 'block', aspectRatio: '1/1', background: 'var(--surface2)', position: 'relative' }}>
                    {g.cover.url
                      ? <img src={g.cover.url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border)' }}><svg width="28" height="28" viewBox="0 0 24 24" {...P}><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="11" r="2" /><path d="m5 19 5-4 3 2 3-3 3 3" /></svg></span>}
                  </span>
                  <span style={{ display: 'block', padding: '8px 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.name || g.workName || '굿즈'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'compose' && picked && (
        <div style={{ maxWidth: 760 }}>
          <button onClick={() => setStep('goods')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'none', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, padding: 0, marginBottom: 12 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" {...P}><path d="m15 18-6-6 6-6" /></svg>굿즈 다시 선택
          </button>

          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>사진 선택 <span style={{ color: 'var(--muted)', fontWeight: 600 }}>({order.length}/10 · 먼저 고른 순서로 배치, 첫 번째가 대표)</span></div>
          {images === null ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>사진 불러오는 중…</div>
          ) : images.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>이 굿즈에 표시할 사진이 없어요.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: 8, marginBottom: 18 }}>
              {images.map(im => {
                const idx = order.indexOf(im.id)
                const on = idx >= 0
                return (
                  <button key={im.id} onClick={() => toggle(im.id)} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 10, overflow: 'hidden', border: on ? '2px solid var(--accent, #ff5692)' : '1px solid var(--border)', background: 'var(--surface2)', cursor: 'pointer', padding: 0 }}>
                    {im.url && <img src={im.url} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                    {on && (
                      <span style={{ position: 'absolute', top: 5, left: 5, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 9999, background: 'var(--accent)', color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{idx === 0 ? '대표' : idx + 1}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>전시글 <span style={{ color: 'var(--muted)', fontWeight: 600 }}>(선택, 최대 500자)</span></div>
          <textarea value={caption} onChange={e => setCaption(e.target.value.slice(0, 500))} rows={3} placeholder="이 굿즈에 대한 짧은 소개를 남겨보세요"
            style={{ width: '100%', boxSizing: 'border-box', padding: '11px 13px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', marginBottom: 18 }} />

          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>공개범위</div>
          <div style={{ display: 'inline-flex', gap: 2, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: 3, marginBottom: 22 }}>
            {VIS.map(v => (
              <button key={v.key} onClick={() => setVisibility(v.key)} style={{ padding: '8px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 800, background: visibility === v.key ? 'var(--surface)' : 'none', color: visibility === v.key ? 'var(--accent)' : 'var(--muted)', boxShadow: visibility === v.key ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>{v.label}</button>
            ))}
          </div>

          {err && <div style={{ color: '#e5484d', fontSize: 13, marginBottom: 12 }}>{err}</div>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/profile/exhibit')} disabled={saving} style={btnGhost}>취소</button>
            <button onClick={submit} disabled={saving || order.length < 1} style={{ ...btnPrimary, opacity: (saving || order.length < 1) ? 0.6 : 1 }}>
              {saving ? '전시하는 중…' : '전시하기'}
            </button>
          </div>
        </div>
      )}
    </GoodsPageShell>
  )
}

const btnPrimary: React.CSSProperties = { height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: 'var(--accent)', color: '#fff', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }
const btnGhost: React.CSSProperties = { height: 44, padding: '0 18px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'inherit', fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }
