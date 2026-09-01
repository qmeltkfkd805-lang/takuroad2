'use client'

import { useState, useEffect } from 'react'
import { getAllTags } from '@/services/shopService'
import {
  getShopTags, updateShopTags, getAllGoodsTypes,
  getShopGoodsCategories, updateShopGoodsCategories, deactivateProductsByTag,
  getShopCustomGoods, updateShopCustomGoods,
} from '@/services/shopProductService'
import { useAuth } from '@/components/layout/AuthProvider'

interface Props {
  shopId: string
}

/** 주력 작품 최대 개수 */
const MAX_PRIMARY = 5


export default function ShopEnrichmentSection({ shopId }: Props) {
  const { user } = useAuth()
  const [allTags, setAllTags] = useState<any[]>([])
  const [myTags, setMyTags] = useState<any[]>([])
  const [allGoodsTypes, setAllGoodsTypes] = useState<any[]>([])
  const [myGoodsCategories, setMyGoodsCategories] = useState<string[]>([])
  const [customGoods, setCustomGoods] = useState<string[]>([])
  const [etcInput, setEtcInput] = useState('')
  const [showEtc, setShowEtc] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tagSearch, setTagSearch] = useState('')
  // 주력 작품 — 취급 작품 중 대표로 내세울 작품(최대 3개). shop_tags.is_primary
  const [primaryIds, setPrimaryIds] = useState<string[]>([])
  const [primarySearch, setPrimarySearch] = useState('')
  const [goodsTagSearch, setGoodsTagSearch] = useState('')
  const [openTagId, setOpenTagId] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [shopId])

  async function loadAll() {
    const [tags, shopTags, goodsTypes, goodsIds, custom] = await Promise.all([
      getAllTags(),
      getShopTags(shopId),
      getAllGoodsTypes(),
      getShopGoodsCategories(shopId),
      getShopCustomGoods(shopId),
    ])
    // '기타'는 항상 맨 뒤로
    const sortedGoods = [...(goodsTypes as any[])].sort((a, b) => {
      const ae = a.name === '기타' ? 1 : 0
      const be = b.name === '기타' ? 1 : 0
      return ae - be
    })
    setAllTags(tags)
    setMyTags(shopTags)
    setPrimaryIds((shopTags as any[]).filter(t => t.isPrimary).map(t => t.id))
    setAllGoodsTypes(sortedGoods)
    setMyGoodsCategories(goodsIds)
    setCustomGoods(custom)
    setShowEtc(custom.length > 0)
    setLoading(false)
  }

  const etcType = allGoodsTypes.find((g: any) => g.name === '기타')

  // 선택하면 바로 저장 — 따로 저장 버튼 없음
  async function saveTags(nextTags: any[], nextPrimary: string[]) {
    setMyTags(nextTags); setPrimaryIds(nextPrimary)
    await updateShopTags(shopId, nextTags.map(t => t.id), nextPrimary)
  }

  async function toggleTag(tag: any) {
    const exists = myTags.some(t => t.id === tag.id)
    const next = exists ? myTags.filter(t => t.id !== tag.id) : [...myTags, tag]
    // 취급 작품에서 빼면 주력 지정도 같이 풀린다
    const nextPrimary = exists ? primaryIds.filter(id => id !== tag.id) : primaryIds
    await saveTags(next, nextPrimary)
    if (exists) await deactivateProductsByTag(shopId, tag.id)  // 작품을 빼면 그 작품의 굿즈도 비활성화
  }

  // 주력 작품 지정/해제 — 지정하면 취급 작품에도 자동으로 들어간다
  async function togglePrimary(tag: any) {
    const on = primaryIds.includes(tag.id)
    if (!on && primaryIds.length >= MAX_PRIMARY) return
    const nextPrimary = on ? primaryIds.filter(id => id !== tag.id) : [...primaryIds, tag.id]
    const nextTags = myTags.some(t => t.id === tag.id) ? myTags : [...myTags, tag]
    await saveTags(nextTags, nextPrimary)
    setPrimarySearch('')
  }

  async function toggleGoodsCategory(id: string) {
    // '기타'는 저장 대상이 아니라 직접 입력창을 여는 토글이다.
    if (etcType && id === etcType.id) { setShowEtc(v => !v); return }
    const next = myGoodsCategories.includes(id) ? myGoodsCategories.filter(g => g !== id) : [...myGoodsCategories, id]
    setMyGoodsCategories(next)
    await updateShopGoodsCategories(shopId, next)
  }

  // '기타' 직접 입력 → 각각 하나의 취급 상품으로 추가
  async function addCustomGood() {
    const v = etcInput.trim()
    if (!v) return
    if (customGoods.includes(v)) { setEtcInput(''); return }
    const next = [...customGoods, v]
    setCustomGoods(next); setEtcInput('')
    await updateShopCustomGoods(shopId, next)
  }
  async function removeCustomGood(v: string) {
    const next = customGoods.filter(g => g !== v)
    setCustomGoods(next)
    await updateShopCustomGoods(shopId, next)
  }

  if (loading) {
    return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  const filteredTags = allTags.filter(tag =>
    tag.name.toLowerCase().includes(tagSearch.toLowerCase())
  )

  const filteredMyTags = myTags.filter(tag =>
    tag.name.toLowerCase().includes(goodsTagSearch.toLowerCase())
  )

  // 주력 작품 — 선택된 것(칩)과 검색 후보(이미 주력인 건 제외)
  const primaryTags = primaryIds
    .map(id => myTags.find(t => t.id === id) ?? allTags.find(t => t.id === id))
    .filter(Boolean)
  const primaryCandidates = allTags
    .filter(t => !primaryIds.includes(t.id) && t.name.toLowerCase().includes(primarySearch.trim().toLowerCase()))
    .slice(0, 40)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* 취급 분야 (작품 무관, 칩 형태 간단 선택) */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Svg size={15} color="var(--accent)"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".8" fill="var(--accent)" /></Svg>취급 분야</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
          이 가게에서 주로 취급하는 분야를 선택해주세요 (복수 선택 가능)
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          {allGoodsTypes.map((gt: any) => {
            const isEtc = etcType && gt.id === etcType.id
            const selected = isEtc ? showEtc : myGoodsCategories.includes(gt.id)
            return (
              <button
                key={gt.id}
                onClick={() => toggleGoodsCategory(gt.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
                  border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                  background: selected ? 'var(--accent-l)' : 'var(--surface)',
                  color: selected ? 'var(--accent)' : 'var(--text)',
                  fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                }}
              >
                <Svg size={13}><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".8" fill="currentColor" /></Svg>
                <span>{gt.name}</span>
                {selected && <Svg size={13} color="var(--accent)"><path d="m5 12 5 5L20 6" /></Svg>}
              </button>
            )
          })}
        </div>
        {(showEtc || customGoods.length > 0) && (
          <div style={{ marginBottom: '12px', padding: '12px', border: '1px dashed var(--border)', borderRadius: '10px', background: 'var(--surface2)' }}>
            <div style={{ fontSize: '12px', fontWeight: 800, marginBottom: '8px', color: 'var(--text)' }}>기타 취급 상품 직접 입력</div>
            {customGoods.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {customGoods.map(v => (
                  <span
                    key={v}
                    onClick={() => removeCustomGood(v)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                      padding: '6px 10px', borderRadius: '16px', cursor: 'pointer',
                      border: '1.5px solid var(--accent)', background: 'var(--accent-l)',
                      color: 'var(--accent)', fontSize: '12px', fontWeight: 700,
                    }}
                  >
                    {v} <Svg size={12}><path d="M18 6 6 18M6 6l12 12" /></Svg>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="text"
                value={etcInput}
                onChange={e => setEtcInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomGood() } }}
                maxLength={30}
                placeholder="예: 넨도로이드 입력 후 Enter"
                style={{
                  flex: 1, padding: '9px 12px',
                  border: '1.5px solid var(--border)', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'inherit',
                  background: 'var(--surface)', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={addCustomGood}
                disabled={!etcInput.trim()}
                style={{ padding: '0 16px', borderRadius: '8px', border: 'none', background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, opacity: etcInput.trim() ? 1 : 0.5 }}
              >
                추가
              </button>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '8px 0 0' }}>입력한 항목 하나하나가 취급 상품으로 등록돼요. 칩을 누르면 삭제돼요.</p>
          </div>
        )}
        <p style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px', margin: 0 }}><Svg size={13} color="var(--accent)"><path d="m5 12 5 5L20 6" /></Svg>선택하면 자동 저장돼요</p>
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* 주력 작품 — 취급 작품 위. 최대 3개, 고르면 취급 작품에도 자동 포함 */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Svg size={15} color="var(--accent)" fill="var(--accent)"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></Svg>
          주력 작품
          <span style={{ fontSize: '12px', fontWeight: 700, color: primaryIds.length ? 'var(--accent)' : 'var(--muted)' }}>{primaryIds.length}/{MAX_PRIMARY}</span>
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
          이 샵을 대표하는 작품이에요. 최대 {MAX_PRIMARY}개까지 고를 수 있고, 고르면 아래 취급 작품에도 자동으로 들어가요.
        </p>

        {primaryTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {primaryTags.map(tag => (
              <span
                key={tag.id}
                onClick={() => togglePrimary(tag)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '7px 12px', borderRadius: '16px', cursor: 'pointer',
                  border: '1.5px solid var(--accent)', background: 'var(--accent)',
                  color: '#fff', fontSize: '12.5px', fontWeight: 800,
                }}
              >
                <Svg size={12} color="#fff" fill="#fff"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></Svg>
                {tag.name} <Svg size={12} color="#fff"><path d="M18 6 6 18M6 6l12 12" /></Svg>
              </span>
            ))}
          </div>
        )}

        {primaryIds.length >= MAX_PRIMARY ? (
          <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '0 0 10px' }}>
            주력 작품은 {MAX_PRIMARY}개까지예요. 바꾸려면 위 칩을 눌러 하나 빼주세요.
          </p>
        ) : (
          <>
            <input
              type="text"
              value={primarySearch}
              onChange={e => setPrimarySearch(e.target.value)}
              placeholder="주력 작품 검색 (예: 원피스, 산리오)"
              style={{
                width: '100%', padding: '9px 12px', marginBottom: '10px',
                border: '1.5px solid var(--border)', borderRadius: '8px',
                fontSize: '13px', fontFamily: 'inherit',
                background: 'var(--surface)', color: 'var(--text)',
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {primarySearch.trim() && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px', maxHeight: '180px', overflowY: 'auto', padding: '2px' }}>
                {primaryCandidates.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--muted)', padding: '10px 0' }}>검색 결과가 없어요</p>
                ) : primaryCandidates.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => togglePrimary(tag)}
                    style={{
                      padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                      border: '1.5px solid var(--border)', background: 'var(--surface)',
                      color: 'var(--text)', fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <p style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px', margin: 0 }}><Svg size={13} color="var(--accent)"><path d="m5 12 5 5L20 6" /></Svg>선택하면 자동 저장돼요</p>
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* 1단계: 취급 작품 (가벼운 입력) */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Svg size={15} color="var(--accent)"><rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5" /></Svg>취급 작품</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '10px' }}>
          이 샵에서 다루는 작품을 선택해주세요
        </p>

        {myTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {myTags.map(tag => (
              <span
                key={tag.id}
                onClick={() => toggleTag(tag)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '6px 10px', borderRadius: '16px', cursor: 'pointer',
                  border: '1.5px solid var(--accent)', background: 'var(--accent-l)',
                  color: 'var(--accent)', fontSize: '12px', fontWeight: 700,
                }}
              >
                {primaryIds.includes(tag.id) && <Svg size={11} color="var(--accent)" fill="var(--accent)"><path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9z" /></Svg>}
                {tag.name} <Svg size={12}><path d="M18 6 6 18M6 6l12 12" /></Svg>
              </span>
            ))}
          </div>
        )}

        <input
          type="text"
          value={tagSearch}
          onChange={e => setTagSearch(e.target.value)}
          placeholder="작품 이름으로 검색 (예: 원피스, 산리오)"
          style={{
            width: '100%', padding: '9px 12px', marginBottom: '10px',
            border: '1.5px solid var(--border)', borderRadius: '8px',
            fontSize: '13px', fontFamily: 'inherit',
            background: 'var(--surface)', color: 'var(--text)',
            outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px',
          maxHeight: '240px', overflowY: 'auto', padding: '2px',
        }}>
          {filteredTags.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--muted)', padding: '10px 0' }}>검색 결과가 없어요</p>
          ) : (
            filteredTags.map(tag => {
              const selected = myTags.some(t => t.id === tag.id)
              if (selected) return null
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag)}
                  style={{
                    padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
                    border: '1.5px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: '13px', fontWeight: 700, fontFamily: 'inherit',
                  }}
                >
                  {tag.name}
                </button>
              )
            })
          )}
        </div>

        <p style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '5px', margin: 0 }}><Svg size={13} color="var(--accent)"><path d="m5 12 5 5L20 6" /></Svg>선택하면 자동 저장돼요</p>
      </div>

    </div>
  )
}


function Svg({ size = 14, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden>{children}</svg>
}