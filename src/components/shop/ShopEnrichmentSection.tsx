'use client'

import { useState, useEffect } from 'react'
import { getAllTags } from '@/services/shopService'
import {
  getShopTags, updateShopTags, getShopProductsBySeries,
  upsertShopProduct, getAllGoodsTypes, Availability, AVAILABILITY_LABEL,
  getShopGoodsCategories, updateShopGoodsCategories,
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
    await updateShopTags(shopId, myTags.map(t => t.id))
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

  async function cycleAvailability(tagId: string, goodsTypeId: string, current: Availability) {
    if (!user) return
    const idx = AVAILABILITY_ORDER.indexOf(current)
    const next = AVAILABILITY_ORDER[(idx + 1) % AVAILABILITY_ORDER.length]
    await upsertShopProduct({
      shopId, tagId, goodsTypeId,
      availability: next,
      source: 'owner',
      confirmedByType: 'owner',
      userId: user.id,
    })
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
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px' }}>📦 취급 분야</h3>
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
                <span>{gt.icon}</span>
                <span>{gt.name}</span>
                {selected && <span style={{ fontSize: '12px' }}>✓</span>}
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
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px' }}>🎮 취급 작품</h3>
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
                {tag.name} ✕
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
        <h3 style={{ fontSize: '14px', fontWeight: 900, marginBottom: '6px' }}>🛍️ 작품별 취급 굿즈</h3>
        <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>
          선택사항이에요. 작품을 눌러서 펼친 다음 입력해주세요.
        </p>
        <p style={{
          fontSize: '12px', color: 'var(--accent)', marginBottom: '14px',
          background: 'var(--accent-l)', borderRadius: '8px', padding: '8px 10px',
        }}>
          💡 칸을 누를 때마다 순서대로 바뀌어요<br />
          <strong>확인안됨 → 판매안함 → 품절 → 소량 → 보통 → 많음</strong>
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
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '6px' }}>
                        {allGoodsTypes.map((gt: any) => {
                          const existing = series?.goodsList.find((g: any) => g.goodsTypeId === gt.id)
                          const availability: Availability = existing?.availability ?? 'unknown'
                          const isSet = availability !== 'unknown'
                          return (
                            <button
                              key={gt.id}
                              onClick={() => cycleAvailability(tag.id, gt.id, availability)}
                              style={{
                                padding: '8px 6px', borderRadius: '8px', textAlign: 'center',
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
