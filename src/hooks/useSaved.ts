'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/layout/AuthProvider'
import { saveBookmark, removeBookmark, getSavedShopIds } from '@/services/shopService'

export function useSaved() {
  const { user } = useAuth()
  const [savedIds, setSavedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) {
      setSavedIds([])
      return
    }
    getSavedShopIds(user.id).then(ids => setSavedIds(ids))
  }, [user])

  const isSaved = useCallback((shopId: string) => {
    return savedIds.includes(shopId)
  }, [savedIds])

  const toggleSave = useCallback(async (shopId: string) => {
    if (!user) return false

    if (isSaved(shopId)) {
      setSavedIds(prev => prev.filter(id => id !== shopId))
      await removeBookmark(shopId, user.id)
    } else {
      setSavedIds(prev => [...prev, shopId])
      await saveBookmark(shopId, user.id)
    }
    return true
  }, [user, isSaved])

  return { savedIds, isSaved, toggleSave, loading }
}