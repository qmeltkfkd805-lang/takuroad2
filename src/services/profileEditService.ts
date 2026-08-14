import { createClient } from '@/lib/supabase/client'
import { getEquipped, getMyCosmetics, getMyBadges, getMyFavoriteWorks, SHOWCASE_MAX } from '@/services/cosmeticService'

/* ============================================================
   프로필 편집 저장 — 아바타를 제외한 DB 값을 "한 번의 profiles UPDATE"로 원자 저장.

   ⭐ 원자성: nickname·bio·equipped 를 각각 저장하면 중간 실패 시 일부만 반영된다.
      → 하나의 UPDATE 문에 담아 전부 성공하거나 전부 실패하게 한다.

   ⭐ 컬럼 화이트리스트: authenticated 는 nickname·avatar_url·bio·equipped·
      is_profile_public·selected_title_id·selected_title_type·app_settings 만 UPDATE 가능.
      payload 에는 nickname·bio·equipped 만 넣는다(role·status 등 절대 금지).
      ⚠️ 혼합 payload에 비허용 컬럼이 하나라도 섞이면 UPDATE 전체가 실패한다.

   ⚠️ 값 재검증(칭호 해금·최애 작품·대표 배지 보유)은 여기서 "클라이언트가 다시 조회"해
      필터링한다. 진짜 서버측 강제는 SECURITY DEFINER RPC가 필요하다(P2, 승인 대상).
      selected_title_id/type 는 레거시라 payload 에 절대 포함하지 않는다.

   ⛔ 아바타(avatar_url)는 여기서 저장하지 않는다 — Storage 정책 승인 후 P2에서 별도.
   ============================================================ */

export interface ProfileEditSnapshot {
  nickname: string
  bio: string
  titleId: string | null       // equipped.title (코스메틱 id)
  featuredWorkId: string | null // equipped.featuredWork (tag_id)
  showcase: string[]           // equipped.showcase (badge_tier id, 최대 3)
}

export interface SaveResult {
  ok: boolean
  /** 필드별 오류 (닉네임 중복 등) */
  fieldError?: { field: 'nickname' | 'general'; message: string }
}

/** 닉네임 중복 확인(본인 제외) — 편의용. 최종 저장 시 unique 제약으로 다시 확정된다. */
export async function checkNicknameAvailable(
  userId: string,
  nickname: string,
): Promise<{ ok: boolean; available?: boolean; message?: string }> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('nickname', nickname)
    .neq('id', userId)
    .maybeSingle()
  if (error) return { ok: false, message: '확인에 실패했어요. 잠시 후 다시 시도해주세요.' }
  return { ok: true, available: !data }
}

/* ────────────────────────────────────────────────
   아바타 Storage — 전용 avatars 버킷(본인 UID 폴더만 insert/update/delete).
   경로: avatars/{uid}/{uuid}.webp (버전된 파일명 → CDN 캐시 문제 회피)
   ──────────────────────────────────────────────── */
const AVATAR_BUCKET = 'avatars'
const AVATAR_PUBLIC_MARKER = '/storage/v1/object/public/avatars/'

/** 크롭 결과(webp Blob) 업로드 → 공개 URL + 스토리지 경로 반환 */
export async function uploadAvatarBlob(
  userId: string,
  blob: Blob,
): Promise<{ ok: boolean; url?: string; path?: string; error?: string }> {
  const supabase = createClient()
  const path = `${userId}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) {
    console.error('[아바타 업로드 실패]', error.message)
    return { ok: false, error: '이미지 업로드에 실패했어요.' }
  }
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return { ok: true, url: data.publicUrl, path }
}

/** URL 이 "avatars 버킷의 이 사용자 폴더" 파일이면 스토리지 경로, 아니면 null.
    ⚠️ 외부 OAuth URL·기존 shop-images 파일·타인 파일은 null → 삭제 대상 아님. */
function ownAvatarPath(userId: string, url: string | null): string | null {
  if (!url) return null
  const i = url.indexOf(AVATAR_PUBLIC_MARKER)
  if (i === -1) return null
  const rel = decodeURIComponent(url.slice(i + AVATAR_PUBLIC_MARKER.length).split('?')[0])
  const first = rel.split('/')[0]
  if (!first || first !== userId) return null   // 본인 UID 폴더만
  return rel
}

/** 이전 내부 아바타 파일 삭제 — 본인 avatars 폴더 파일만. 실패는 로그만(치명적 아님). */
export async function deleteInternalAvatar(userId: string, url: string | null): Promise<void> {
  const path = ownAvatarPath(userId, url)
  if (!path) return
  try {
    const supabase = createClient()
    const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path])
    if (error) console.warn('[아바타 이전 파일 정리 실패, 무시]', error.message)
  } catch (e) {
    console.warn('[아바타 이전 파일 정리 예외, 무시]', e)
  }
}

export type AvatarChange =
  | { mode: 'keep'; currentUrl: string | null }
  | { mode: 'new'; blob: Blob; currentUrl: string | null }
  | { mode: 'reset'; currentUrl: string | null }

/**
 * 프로필 값 저장.
 * DB 값(nickname·bio·equipped·avatar_url)은 "한 번의 profiles UPDATE"로 원자 저장.
 * 아바타 안전 순서: (new) 업로드 → UPDATE 성공 확인 → 이전 본인 파일만 정리.
 * UPDATE 실패 시 새로 올린 파일은 롤백 삭제. 이전 파일 삭제 실패는 로그만.
 * @param original nickname 변경 여부 판단용 스냅샷
 * @param avatar   아바타 변경(없으면 keep)
 */
export async function saveProfileEdit(
  userId: string,
  next: ProfileEditSnapshot,
  original: ProfileEditSnapshot,
  avatar: AvatarChange = { mode: 'keep', currentUrl: null },
): Promise<SaveResult> {
  const supabase = createClient()

  // ── 값 재검증(클라이언트 재조회 후 필터) ──
  const [cosmetics, badges, favWorks, curEquipped] = await Promise.all([
    getMyCosmetics(userId),
    getMyBadges(userId),
    getMyFavoriteWorks(userId),
    getEquipped(userId),
  ])

  // 칭호: 실제 해금된 title 코스메틱만 허용
  const unlockedTitleIds = new Set(
    cosmetics.filter(c => c.type === 'title' && c.unlocked).map(c => c.id),
  )
  const titleId = next.titleId && unlockedTitleIds.has(next.titleId) ? next.titleId : null

  // 최애 작품: 실제 내 최애(tag_id)만 허용
  const favIds = new Set(favWorks.map(w => w.tagId))
  const featuredWorkId = next.featuredWorkId && favIds.has(next.featuredWorkId) ? next.featuredWorkId : null

  // 대표 배지: 실제 획득 배지만, 중복 제거, 최대 3개, 순서 유지
  const ownedTierIds = new Set(badges.map(b => b.tierId))
  const showcase = [...new Set(next.showcase)].filter(id => ownedTierIds.has(id)).slice(0, SHOWCASE_MAX)

  // ── equipped 병합: 기존 키(frame·background·effect·theme·tagline 등) 보존 ──
  const mergedEquipped: Record<string, any> = { ...(curEquipped as any) }
  if (titleId) mergedEquipped.title = titleId
  else delete mergedEquipped.title
  mergedEquipped.featuredWork = featuredWorkId ?? null
  mergedEquipped.showcase = showcase
  // ⚠️ tagline 은 건드리지 않는다(소개글은 bio 단일 기준으로 이전 중)

  // ── 아바타: DB UPDATE 전에 새 파일부터 올린다(안전 순서 1~2) ──
  let uploadedPath: string | null = null
  let avatarUrlSet = false
  let avatarUrlValue: string | null = null
  if (avatar.mode === 'new') {
    const up = await uploadAvatarBlob(userId, avatar.blob)
    if (!up.ok) return { ok: false, fieldError: { field: 'general', message: up.error ?? '이미지 업로드에 실패했어요.' } }
    uploadedPath = up.path ?? null
    avatarUrlSet = true; avatarUrlValue = up.url ?? null
  } else if (avatar.mode === 'reset') {
    avatarUrlSet = true; avatarUrlValue = null
  }

  // ── payload: 화이트리스트 컬럼만(nickname·bio·equipped·avatar_url) ──
  const payload: Record<string, any> = {
    bio: next.bio.trim() || null,
    equipped: mergedEquipped,
  }
  if (next.nickname !== original.nickname) payload.nickname = next.nickname
  if (avatarUrlSet) payload.avatar_url = avatarUrlValue

  const { error } = await supabase.from('profiles').update(payload as any).eq('id', userId)

  if (error) {
    // DB 실패 → 방금 올린 미사용 파일 롤백 삭제
    if (uploadedPath) {
      try { await supabase.storage.from(AVATAR_BUCKET).remove([uploadedPath]) } catch { /* noop */ }
    }
    // 닉네임 unique 위반(동시 저장 경쟁 포함)
    if ((error as any).code === '23505' || /nickname/i.test(error.message)) {
      return { ok: false, fieldError: { field: 'nickname', message: '이미 사용 중인 닉네임이에요.' } }
    }
    console.error('[프로필 저장 실패]', error.message, (error as any).code)
    return { ok: false, fieldError: { field: 'general', message: '저장에 실패했어요. 잠시 후 다시 시도해주세요.' } }
  }

  // ── 저장 성공 후: 이전 내부 아바타 파일만 정리(로그만, 실패해도 저장은 성공) ──
  if (avatar.mode !== 'keep') {
    await deleteInternalAvatar(userId, avatar.currentUrl)
  }
  return { ok: true }
}
