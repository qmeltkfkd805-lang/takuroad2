'use client'

import { useState, useEffect, useRef } from 'react'
import { Shop } from '@/types/shop'
import { useDebounce } from './useDebounce'

export function useSearch(shops: Shop[]) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Shop[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (!q) {
      setResults([])
      setIsOpen(false)
      return
    }
    const matched = shops.filter(s =>
      s.name.includes(q) ||
      (s.addr ?? '').includes(q) ||
      s.cats.some(c => c.includes(q))
    ).slice(0, 10)
    setResults(matched)
    setIsOpen(matched.length > 0)
  }, [debouncedQuery, shops])

  function clearSearch() {
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  return { query, setQuery, results, isOpen, setIsOpen, clearSearch }
}
