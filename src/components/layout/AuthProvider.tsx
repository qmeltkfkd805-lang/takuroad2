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
  /** 현재 로그인 유저의 프로필을 다시 읽어 전역 상태를 갱신한다(저장 후 즉시 반영용). */
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
  refreshProfile: async () => {},
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

  /* select('*') 대신 Profile 타입에 있는 컬럼만 명시한다.
     - 타입(@/types/database의 Profile)이 원래 이 7개뿐이라 쓰는 범위와 정확히 같다.
       화면에서 실제로 읽는 건 nickname·avatar_url·role 셋뿐이지만 타입을 그대로 채운다.
     - '*'로 긁어오면 admin_note·signup_* 같은 내부 컬럼까지 브라우저로 내려온다.
       그 컬럼들은 anon/authenticated의 SELECT 권한을 회수할 예정인데,
       '*'를 두면 권한 적용 순간 이 조회가 통째로 실패한다(권한 없는 컬럼이 하나라도
       포함되면 쿼리 전체가 거부된다). 컬럼을 명시하면 영향이 없다. */
  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, avatar_url, bio, role, created_at, updated_at')
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

  // 저장 후 전역 프로필 즉시 반영 — 현재 유저가 있을 때만 다시 읽는다(없으면 무해한 no-op)
  async function refreshProfile() {
    const { data: { user: cur } } = await supabase.auth.getUser()
    if (!cur) return
    await loadProfile(cur.id)
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin: profile?.role === 'admin',
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
