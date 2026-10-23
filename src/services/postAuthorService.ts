import { createClient } from '@/lib/supabase/client'

/* 커뮤니티 글 작성자 바꾸기 — 타쿠로드 공식 계정만 (DB 함수 transfer_post_author 가 막는다)
   DB: migrations/community_post_transfer_author.sql */

export interface AuthorPick { id: string; nickname: string; avatarUrl: string | null }

/** 닉네임으로 회원 찾기 (작성자 바꾸기 고르기용) */
export async function searchMembersByNickname(q: string, limit = 12): Promise<AuthorPick[]> {
  const kw = q.trim().replace(/[%,]/g, '')
  if (!kw) return []
  const supabase = createClient()
  const { data, error } = await supabase.from('profiles').select('id, nickname, avatar_url').ilike('nickname', `%${kw}%`).limit(limit)
  if (error) { console.error('[작성자 바꾸기] 회원 찾기 실패:', error.message); return [] }
  return ((data ?? []) as { id: string; nickname: string | null; avatar_url: string | null }[])
    .filter(p => p.nickname)
    .map(p => ({ id: String(p.id), nickname: String(p.nickname), avatarUrl: p.avatar_url ?? null }))
}

/** 글 작성자를 바꾼다. 'ok' / 'forbidden'(타쿠로드 계정이 아님) / 'error' */
export async function transferPostAuthor(postId: string, newAuthorId: string): Promise<'ok' | 'forbidden' | 'error'> {
  const supabase: any = createClient()   // 새 함수라 타입 정의에 아직 없음
  const { data, error } = await supabase.rpc('transfer_post_author', { p_post_id: postId, p_new_author: newAuthorId })
  if (error) { console.error('[작성자 바꾸기] 실패:', error.message); return error.code === '42501' ? 'forbidden' : 'error' }
  return data === true ? 'ok' : 'error'
}
