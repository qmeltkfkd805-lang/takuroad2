'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/layout/AuthProvider'
import { ROUTES } from '@/lib/constants/routes'
import { getMyPassport, OtakuPassport } from '@/services/passportService'
import ProfileDesktop from './ProfileDesktop'
import LogoLoader from '@/components/common/LogoLoader'

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

  // 경험치·레벨이 바뀌었을 수 있을 때 다시 읽는다 — 새 알림이 왔을 때(TopBar 'exp-changed'),
  // 다른 화면에 갔다 돌아왔을 때. (관리자가 샵을 공개해 경험치가 들어와도 새로고침 없이 반영)
  const uid = user?.id ?? null
  useEffect(() => {
    if (!uid) return
    let last = 0
    const reload = () => {
      if (document.visibilityState === 'hidden') return
      if (Date.now() - last < 15000) return   // 몰려도 15초에 한 번만
      last = Date.now()
      getMyPassport(uid).then(setPassport).catch(() => {})
    }
    window.addEventListener('exp-changed', reload)
    document.addEventListener('visibilitychange', reload)
    return () => {
      window.removeEventListener('exp-changed', reload)
      document.removeEventListener('visibilitychange', reload)
    }
  }, [uid])

  if (loading || !user || !profile) {
    return <LogoLoader size="md" />
  }

  return <ProfileDesktop passport={passport} userId={user.id} />
}
