import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

/* ============================================================
   공개 프로필 접근 판단 — 서버 전용 (service-role 사용. 클라이언트에서 import 금지)

   누가 무엇을 볼 수 있는지 한 곳에서 정한다.
   - 차단 관계        → 프로필 자체 없음(비공개와 같은 응답, 방향 노출 없음)
   - 프로필 비공개     → 본인만 (기존 getPublicPassport 규칙 유지)
   - 항목별 공개범위   → profiles.privacy_settings (public / followers / private)
       저장값이 없으면 is_profile_public 이 true 일 때만 public, 아니면 private
       (DB 의 goods_profile_scope 와 같은 규칙 — null 은 공개로 보지 않는다)
   - followers 단계   → 보는 사람이 주인을 팔로우 중일 때만

   ⭐ privacy_settings 원문은 절대 응답에 싣지 않는다. 판단 결과(boolean)만 쓴다.
   ⭐ 여기서 공개 범위를 넓히지 않는다. 각 API 는 이 판단 + 원본의 권한(RLS·RPC)을 둘 다 통과해야 보여준다.
   ============================================================ */

export type PrivacyTarget =
  | 'follows' | 'activity' | 'visited_shops'
  | 'completed_routes' | 'liked_works' | 'collections' | 'goods'
type Level = 'public' | 'followers' | 'private'
const LEVELS: Level[] = ['public', 'followers', 'private']

export interface ProfileAccess {
  owner: { id: string; nickname: string; avatarUrl: string | null; bio: string | null; featuredWorkId: string | null }
  viewerId: string | null
  isSelf: boolean
  isFollower: boolean
  /** 이 항목을 지금 보는 사람에게 보여줘도 되는가 */
  allow: (t: PrivacyTarget) => boolean
  /** 보는 사람 세션의 Supabase 클라이언트 (RLS·RPC 가 보는 사람 기준으로 판단) */
  viewer: Awaited<ReturnType<typeof createClient>>
  svc: ReturnType<typeof serviceClient>
}

type Key = { nickname: string } | { id: string }

/** 볼 수 없으면 null (없는 사용자·차단·비공개 프로필 모두 같은 null) */
export async function resolveProfileAccess(key: Key): Promise<ProfileAccess | null> {
  const viewer = await createClient()
  const svc = serviceClient()
  const { data: { user } } = await viewer.auth.getUser()
  const viewerId = user?.id ?? null

  let q = svc.from('profiles').select('id, nickname, avatar_url, bio, is_profile_public, privacy_settings, equipped')
  q = 'id' in key ? q.eq('id', key.id) : q.eq('nickname', key.nickname)
  const { data: p } = await q.maybeSingle()
  const prof = p as any
  if (!prof) return null

  const isSelf = !!viewerId && viewerId === prof.id

  if (!isSelf) {
    if (viewerId) {
      // 보는 사람 세션으로 물어야 auth.uid() 가 채워진다 (대칭 boolean)
      const { data: blocked } = await viewer.rpc('is_blocked_between', { target: prof.id })
      if (blocked === true) return null
    }
    if (prof.is_profile_public !== true) return null
  }

  let isFollower = false
  if (viewerId && !isSelf) {
    const { data: f } = await svc.from('user_follows').select('follower_id')
      .eq('follower_id', viewerId).eq('following_id', prof.id).limit(1)
    isFollower = (f ?? []).length > 0
  }

  const saved = (prof.privacy_settings && typeof prof.privacy_settings === 'object') ? prof.privacy_settings : {}
  const fallback: Level = prof.is_profile_public === true ? 'public' : 'private'
  const levelOf = (t: PrivacyTarget): Level => {
    const v = saved[t]
    return (typeof v === 'string' && (LEVELS as string[]).includes(v)) ? (v as Level) : fallback
  }
  const allow = (t: PrivacyTarget) => {
    if (isSelf) return true
    const lv = levelOf(t)
    return lv === 'public' || (lv === 'followers' && isFollower)
  }

  const fw = prof.equipped?.featuredWork
  return {
    owner: {
      id: prof.id,
      nickname: prof.nickname,
      avatarUrl: prof.avatar_url ?? null,
      bio: typeof prof.bio === 'string' && prof.bio.trim() ? prof.bio.trim() : null,
      featuredWorkId: typeof fw === 'string' && fw ? fw : null,
    },
    viewerId, isSelf, isFollower, allow, viewer, svc,
  }
}

export const isHttp = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//.test(v)

/** 굿즈 이미지 한 장을 표시 URL 로 — 이미 권한 확인을 통과한 행에만 쓴다.
    goods-images(비공개)는 service-role 서명, community(shop-images)는 공개 URL, external 은 https 만. */
export async function resolveGoodsImageUrls(
  svc: ReturnType<typeof serviceClient>,
  imgs: { storageOwner: string | null; bucket: string | null; path: string | null; external: string | null }[],
  ttlSec = 600,
): Promise<(string | null)[]> {
  const out: (string | null)[] = imgs.map(() => null)
  const toSign: { i: number; path: string }[] = []
  imgs.forEach((c, i) => {
    if (c.storageOwner === 'goods' && c.bucket === 'goods-images' && c.path) toSign.push({ i, path: c.path })
    else if (c.storageOwner === 'community' && c.bucket === 'shop-images' && c.path)
      out[i] = svc.storage.from('shop-images').getPublicUrl(c.path).data.publicUrl ?? null
    else if (c.storageOwner === 'external' && c.external && c.external.startsWith('https://')) out[i] = c.external
  })
  if (toSign.length) {
    const { data } = await svc.storage.from('goods-images').createSignedUrls(toSign.map(t => t.path), ttlSec)
    ;(data ?? []).forEach((d, k) => { out[toSign[k].i] = d?.signedUrl ?? null })
  }
  return out
}

export const noStore = { 'Cache-Control': 'private, no-store' }
