// 관리자 전용 쓰기 헬퍼. /api/admin/upsert 를 호출해서 Service Role로 안전하게 쓴다.
export interface AdminUpsertArgs {
  table: 'tags' | 'featured_banners' | 'profiles' | 'home_hero_slots'
  id?: string
  fields?: Record<string, any>
  action?: 'update' | 'insert' | 'delete'
}

export async function adminUpsert(
  args: AdminUpsertArgs
): Promise<{ ok: boolean; row?: any; error?: string }> {
  try {
    const res = await fetch('/api/admin/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const text = await res.text()
    const json = text ? JSON.parse(text) : {}
    if (!res.ok) return { ok: false, error: json.error ?? `요청 실패 (HTTP ${res.status})` }
    return { ok: true, row: json.row }
  } catch (e: any) {
    return { ok: false, error: e.message ?? '네트워크 오류' }
  }
}

