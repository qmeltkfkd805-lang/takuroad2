'use client'

import { useState, useEffect, useMemo } from 'react'
import { Shop } from '@/types/shop'
import { getShops } from '@/services/shopService'

export function useShops() {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState<string>('전체')
  const [selectedRegion, setSelectedRegion] = useState<string>('전체')
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)

  useEffect(() => {
    getShops().then(data => {
      setShops(data)
      setLoading(false)
    })
  }, [])

  // 카테고리 + 지역 필터 적용
  const filtered = useMemo(() => {
    return shops.filter(shop => {
      const catMatch = selectedCat === '전체' || shop.cats.includes(selectedCat)
      const regionMatch = selectedRegion === '전체' || shop.region === selectedRegion
      return catMatch && regionMatch
    })
  }, [shops, selectedCat, selectedRegion])

  // 지도에 표시할 샵 (온라인샵 제외)
  const mapShops = useMemo(() => {
    return filtered.filter(s => s.lat && s.lng && !s.cats.includes('온라인샵'))
  }, [filtered])

  // 지역 목록 (현재 필터 기준)
  const regions = useMemo(() => {
    const set = new Set(shops.map(s => s.region).filter(Boolean) as string[])
    return ['전체', ...Array.from(set).sort()]
  }, [shops])

  return {
    shops,
    filtered,
    mapShops,
    regions,
    loading,
    selectedCat,
    setSelectedCat,
    selectedRegion,
    setSelectedRegion,
    selectedShop,
    setSelectedShop,
  }
}
