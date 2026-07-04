'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('[AuthProvider] 프로필 읽기 실패:', error)
    setProfile(data ?? null)
  }

  useEffect(() => {
    let active = true

    // 초기 세션 확인 (콜백 밖이라 await 안전)
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return
      setUser(user)
      if (user) await loadProfile(user.id)
      if (active) setLoading(false)
    })

    // 세션 변경 구독
    // ⚠️ onAuthStateChange 콜백 "안에서" supabase 쿼리를 await 하면
    //    클라이언트가 멈추는(deadlock) 알려진 이슈가 있어 → 콜백은 동기로 두고
    //    프로필 조회는 setTimeout(0)으로 콜백 밖으로 빼서 실행한다.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          setTimeout(() => { if (active) loadProfile(currentUser.id) }, 0)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => { active = false; subscription.unsubscribe() }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
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
