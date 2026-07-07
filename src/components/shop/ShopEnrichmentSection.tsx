'use client'

import { useState, useEffect } from 'react'
import { getAllTags } from '@/services/shopService'
import {
  getShopTags, updateShopTags, getShopProductsBySeries,
  upsertShopProduct, getAllGoodsTypes, Availability, AVAILABILITY_LABEL,
  getShopGoodsCategories, updateShopGoodsCategories, deactivateProductsByTag,
} from '@/services/shopProductService'
import { useAuth } from '@/components/layout/AuthProvider'

interface Props {
  shopId: string
}

const AVAILABILITY_ORDER: Availability[] = ['unknown', 'not_sold', 'sold_out', 'few', 'normal', 'many']

export default function ShopEnrichmentSection({ shopId }: Props) {
  const { user } = useAuth()
  const [allTags, setAllTags] = useState<any[]>([])
  const [myTags, setMyTags] = useState<any[]>([])
  const [allGoodsTypes, setAllGoodsTypes] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [myGoodsCategories, setMyGoodsCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTags, setSavingTags] = useState(false)
  const [savingCategories, setSavingCategories] = useState(false)
  const [tagSearch, setTagSearch] = useState('')
  const [goodsTagSearch, setGoodsTagSearch] = useState('')
  const [openTagId, setOpenTagId] = useState<string | null>(null)
  const [openGoodsKey, setOpenGoodsKey] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [shopId])

  async function loadAll() {
    const [tags, shopTags, goodsTypes, productsBySeries, goodsCategories] = await Promise.all([
      getAllTags(),
      getShopTags(shopId),
      getAllGoodsTypes(),
      getShopProductsBySeries(shopId),
      getShopGoodsCategories(shopId),
    ])
    setAllTags(tags)
    setMyTags(shopTags)
    setAllGoodsTypes(goodsTypes)
    setProducts(productsBySeries)
    setMyGoodsCategories(goodsCategories)
    setLoading(false)
  }

  function toggleTag(tag: any) {
    setMyTags(prev =>
      prev.some(t => t.id === tag.id)
        ? prev.filter(t => t.id !== tag.id)
        : [...prev, tag]
    )
  }

  async function saveTags() {
    setSavingTags(true)

    const previousTagIds = (await getShopTags(shopId)).map((t: any) => t.id)
    const currentTagIds = myTags.map(t => t.id)
    const removedTagIds = previousTagIds.filter(id => !currentTagIds.includes(id))

    await updateShopTags(shopId, currentTagIds)

    for (const removedTagId of removedTagIds) {
      await deactivateProductsByTag(shopId, removedTagId)
    }

    await loadAll()
    setSavingTags(false)
  }

  function toggleGoodsCategory(id: string) {
    setMyGoodsCategories(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  async function saveGoodsCategories() {
    setSavingCategories(true)
    await updateShopGoodsCategories(shopId, myGoodsCategories)
    setSavingCategories(false)
  }

  async function setAvailability(tagId: string, goodsTypeId: string, value: Availability) {
    if (!user) return
    await upsertShopProduct({
      shopId, tagId, goodsTypeId,
      availability: value,
      source: 'owner',
      confirmedByType: 'owner',
      userId: user.id,
    })
    setOpenGoodsKey(null)
    await loadAll()
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
            const selected = myGoodsCategories.includes(gt.id)
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
        <button
          onClick={saveGoodsCategories}
          disabled={savingCategories}
          style={{
            padding: '9px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {savingCategories ? '저장 중...' : '취급 분야 저장'}
        </button>
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

        <button
          onClick={saveTags}
          disabled={savingTags}
          style={{
            padding: '9px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: '#fff', fontWeight: 700,
            fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {savingTags ? '저장 중...' : '취급 작품 저장'}
        </button>
      </div>

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* 2단계: 작품별 굿즈 상세 (아코디언, 평소엔 접힌 상태) */}
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}><Svg size={15} color="var(--accent)"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></Svg>작품별 취급 굿즈</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
          선택사항이에요. 작품을 눌러서 펼친 다음, 굿즈 칸을 눌러 재고 상태를 선택해주세요.
        </p>

        {myTags.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--muted)' }}>먼저 위에서 취급 작품을 선택하고 저장해주세요</p>
        ) : (
          <>
            {myTags.length > 5 && (
              <input
                type="text"
                value={goodsTagSearch}
                onChange={e => setGoodsTagSearch(e.target.value)}
                placeholder="작품 검색..."
                style={{
                  width: '100%', padding: '9px 12px', marginBottom: '10px',
                  border: '1.5px solid var(--border)', borderRadius: '8px',
                  fontSize: '13px', fontFamily: 'inherit',
                  background: 'var(--surface)', color: 'var(--text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            )}

            {filteredMyTags.map(tag => {
              const series = products.find(p => p.tagId === tag.id)
              const isOpen = openTagId === tag.id
              const filledCount = series?.goodsList.filter((g: any) => g.availability !== 'unknown').length ?? 0

              return (
                <div key={tag.id} style={{ marginBottom: '8px', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    onClick={() => setOpenTagId(isOpen ? null : tag.id)}
                    style={{
                      width: '100%', padding: '12px 14px', display: 'flex',
                      justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--surface2)', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '13px' }}>
                      {tag.name}
                      {filledCount > 0 && (
                        <span style={{ color: 'var(--accent)', fontWeight: 700, marginLeft: '6px' }}>
                          ({filledCount}개 입력됨)
                        </span>
                      )}
                    </span>
                    <span style={{ display: 'inline-flex', color: 'var(--muted)' }}>{isOpen ? <Svg size={13}><path d="m18 15-6-6-6 6" /></Svg> : <Svg size={13}><path d="m6 9 6 6 6-6" /></Svg>}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
                        {allGoodsTypes.map((gt: any) => {
                          const existing = series?.goodsList.find((g: any) => g.goodsTypeId === gt.id)
                          const availability: Availability = existing?.availability ?? 'unknown'
                          const isSet = availability !== 'unknown'
                          const goodsKey = `${tag.id}-${gt.id}`
                          const isGoodsOpen = openGoodsKey === goodsKey

                          return (
                            <div key={gt.id} style={{ position: 'relative' }}>
                              <button
                                onClick={() => setOpenGoodsKey(isGoodsOpen ? null : goodsKey)}
                                style={{
                                  width: '100%', padding: '8px 6px', borderRadius: '8px', textAlign: 'center',
                                  border: `1.5px solid ${isSet ? 'var(--accent)' : 'var(--border)'}`,
                                  background: isSet ? 'var(--accent-l)' : 'var(--surface)',
                                  cursor: 'pointer', fontFamily: 'inherit',
                                }}
                              >
                                <div style={{ fontSize: '16px' }}>{gt.icon}</div>
                                <div style={{ fontSize: '10px', fontWeight: 700, marginTop: '2px' }}>{gt.name}</div>
                                <div style={{
                                  fontSize: '9px', fontWeight: 700, marginTop: '2px',
                                  color: isSet ? 'var(--accent)' : 'var(--muted)',
                                }}>
                                  {AVAILABILITY_LABEL[availability]}
                                </div>
                              </button>

                              {isGoodsOpen && (
                                <div style={{
                                  position: 'absolute', top: '100%', left: 0, zIndex: 20,
                                  marginTop: '4px', background: 'var(--surface)',
                                  border: '1px solid var(--border)', borderRadius: '8px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,.15)', overflow: 'hidden',
                                  minWidth: '110px',
                                }}>
                                  {AVAILABILITY_ORDER.map(opt => (
                                    <button
                                      key={opt}
                                      onClick={() => setAvailability(tag.id, gt.id, opt)}
                                      style={{
                                        display: 'block', width: '100%', padding: '8px 12px',
                                        textAlign: 'left', border: 'none',
                                        background: opt === availability ? 'var(--accent-l)' : 'var(--surface)',
                                        color: opt === availability ? 'var(--accent)' : 'var(--text)',
                                        fontWeight: opt === availability ? 700 : 400,
                                        fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
                                      }}
                                    >
                                      {AVAILABILITY_LABEL[opt]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}


function Svg({ size = 14, color = 'currentColor', fill = 'none', children }: { size?: number; color?: string; fill?: string; children: React.ReactNode }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-2px', flexShrink: 0 }} aria-hidden>{children}</svg>
}
