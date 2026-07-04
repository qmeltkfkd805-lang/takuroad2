'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
})

// 프로필 없이도 머무를 수 있는 경로 (닉네임 설정 강제 이동 제외)
const SETUP_EXEMPT = ['/profile/setup', '/login', '/auth']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoaded, setProfileLoaded] = useState(false)

  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('[AuthProvider] 프로필 읽기 실패:', error)
    setProfile(data ?? null)
    setProfileLoaded(true)
  }

  useEffect(() => {
    let active = true

    // 초기 세션 확인 (콜백 밖이라 await 안전)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return
      setUser(user)
      if (user) await loadProfile(user.id)
      else setProfileLoaded(true)
      if (active) setLoading(false)
    })

    // 세션 변경 구독
    // ⚠️ onAuthStateChange 콜백 "안에서" supabase 쿼리를 await 하면
    //    클라이언트가 멈추는(deadlock) 알려진 이슈 → 콜백은 동기, 조회는 setTimeout(0)으로 분리
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          setProfileLoaded(false)
          setTimeout(() => { if (active) loadProfile(currentUser.id) }, 0)
        } else {
          setProfile(null)
          setProfileLoaded(true)
        }
        setLoading(false)
      }
    )

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  // 로그인했는데 프로필이 없으면 → 닉네임 설정으로 강제 이동
  useEffect(() => {
    if (loading || !profileLoaded) return   // 아직 판단할 준비 안 됨
    if (!user || profile) return             // 비로그인 or 프로필 있음 → OK
    if (!pathname) return
    if (SETUP_EXEMPT.some((p) => pathname.startsWith(p))) return
    router.replace('/profile/setup')
  }, [loading, profileLoaded, user, profile, pathname, router])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setProfileLoaded(true)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
