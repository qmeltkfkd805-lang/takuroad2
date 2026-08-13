'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getMyPassport, OtakuPassport } from '@/services/passportService'
import ProfileDesktop from './ProfileDesktop'

/* 마이페이지는 이제 PC·모바일이 동일한 대시보드 레이아웃을 쓴다.
   (여권 테마·프로필 꾸미기 화면은 제거됨 — 개성 표현은 프로필 편집에서 관리) */
export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, loading } = useAuth()
  const [passport, setPassport] = useState<OtakuPassport | null>(null)

  useEffect(() => {
    if (!loading && !user) router.push(ROUTES.login)
  }, [loading, user, router])

  useEffect(() => {
    if (user) getMyPassport(user.id).then(setPassport).catch(() => {})
  }, [user])

  if (loading || !user || !profile) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--muted)' }}>불러오는 중...</div>
  }

  return <ProfileDesktop passport={passport} userId={user.id} />
}
