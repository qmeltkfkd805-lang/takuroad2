'use client'

import { useState, useEffect } from 'react'
import { getAllTags } from '@/services/shopService'
import {
  getShopTags, updateShopTags, getAllGoodsTypes,
  getShopGoodsCategories, updateShopGoodsCategories, deactivateProductsByTag,
} from '@/services/shopProductService'
import { useAuth } from '@/components/layout/AuthProvider'

interface Props {
  shopId: string
}


export default function ShopEnrichmentSection({ shopId }: Props) {
  const { user } = useAuth()
  const [allTags, setAllTags] = useState<any[]>([])
  const [myTags, setMyTags] = useState<any[]>([])
  const [allGoodsTypes, setAllGoodsTypes] = useState<any[]>([])
  const [myGoodsCategories, setMyGoodsCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [tagSearch, setTagSearch] = useState('')
  const [goodsTagSearch, setGoodsTagSearch] = useState('')
  const [openTagId, setOpenTagId] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [shopId])

  async function loadAll() {
    const [tags, shopTags, goodsTypes, goodsCategories] = await Promise.all([
      getAllTags(),
      getShopTags(shopId),
      getAllGoodsTypes(),
      getShopGoodsCategories(shopId),
    ])
    setAllTags(tags)
    setMyTags(shopTags)
    setAllGoodsTypes(goodsTypes)
    setMyGoodsCategories(goodsCategories)
    setLoading(false)
  }

  // 선택하면 바로 저장 — 따로 저장 버튼 없음
  async function toggleTag(tag: any) {
    const exists = myTags.some(t => t.id === tag.id)
    const next = exists ? myTags.filter(t => t.id !== tag.id) : [...myTags, tag]
    setMyTags(next)
    await updateShopTags(shopId, next.map(t => t.id))
    if (exists) await deactivateProductsByTag(shopId, tag.id)  // 작품을 빼면 그 작품의 굿즈도 비활성화
  }

  async function toggleGoodsCategory(id: string) {
    const next = myGoodsCategories.includes(id) ? myGoodsCategories.filter(g => g !== id) : [...myGoodsCategories, id]
    setMyGoodsCategories(next)
    await updateShopGoodsCategories(shopId, next)
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