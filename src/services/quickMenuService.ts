import { createClient } from '@/lib/supabase/client'

/* 빠른 메뉴(마이페이지) 사용자 설정 — profiles.equipped.quickMenu 에 순서대로 저장한다.
   equipped 는 코스메틱/문구 등과 공유하는 JSON이라, 반드시 읽어서 병합(다른 키 보존) 후 쓴다. */

async function readEquipped(userId: string): Promise<any> {
  const supabase = createClient()
  const { data } = await supabase.from('profiles').select('equipped').eq('id', userId).maybeSingle()
  return (data as any)?.equipped ?? {}
}

/** 저장된 빠른 메뉴 키 배열. 설정한 적 없으면 null(→ 기본값 사용) */
export async function getQuickMenu(userId: string): Promise<string[] | null> {
  const eq = await readEquipped(userId)
  const raw = (eq as any).quickMenu
  return Array.isArray(raw) ? raw.filter((k: any) => typeof k === 'string') : null
}

/** 빠른 메뉴 키 배열 저장(순서 = 표시 순서) */
export async function setQuickMenu(userId: string, keys: string[]): Promise<{ ok: boolean }> {
  const supabase = createClient()
  const eq = await readEquipped(userId)
  const merged: any = { ...eq, quickMenu: keys }
  const { error } = await supabase.from('profiles').update({ equipped: merged } as any).eq('id', userId)
  if (error) { console.error('[빠른 메뉴 저장 실패]', error.message); return { ok: false } }
  return { ok: true }
}
