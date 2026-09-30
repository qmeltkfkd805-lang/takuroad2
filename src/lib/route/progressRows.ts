/* 방문 체크(route_progress) 읽기·쓰기 — 방문지 id(샵 id 또는 "샵id@층") 기준.
   서버(Service Role)와 브라우저 클라이언트가 같이 쓴다.
   stop_floor 칸이 아직 없을 때(migrations/route_stop_floors.sql 실행 전)도 층 없는 방문지는 그대로 동작한다. */
import { parseStopKey, rowStopKey } from './stopKey'

type Client = any   // SupabaseClient (서버·브라우저 둘 다)

const missingCol = (e: any) => !!e && /stop_floor/.test(`${e?.message ?? ''} ${e?.details ?? ''} ${e?.hint ?? ''}`)

/** 이 루트에서 이 사람이 체크한 방문지 id */
export async function progressKeys(client: Client, routeId: string, userId: string): Promise<Set<string>> {
  const { data } = await client.from('route_progress').select('*').eq('route_id', routeId).eq('user_id', userId)
  return new Set(((data ?? []) as any[]).filter(r => r.shop_id).map(r => rowStopKey(r)))
}

/** 방문 체크 추가 (이미 있는 건 건너뜀) */
export async function addProgress(client: Client, routeId: string, userId: string, keys: string[]): Promise<boolean> {
  if (!keys.length) return true
  const have = await progressKeys(client, routeId, userId)
  const rows = Array.from(new Set(keys)).filter(k => !have.has(k)).map(k => {
    const { shopId, stopFloor } = parseStopKey(k)
    return { route_id: routeId, user_id: userId, shop_id: shopId, stop_floor: stopFloor }
  })
  if (!rows.length) return true
  const { error } = await client.from('route_progress').insert(rows as any)
  if (error) console.error('[route progress] add', error.code, error.message)
  return !error
}

/** 방문 체크 풀기 */
export async function removeProgress(client: Client, routeId: string, userId: string, keys: string[]): Promise<boolean> {
  let ok = true
  for (const k of Array.from(new Set(keys))) {
    const { shopId, stopFloor } = parseStopKey(k)
    let { error } = await client.from('route_progress').delete()
      .eq('route_id', routeId).eq('user_id', userId).eq('shop_id', shopId).eq('stop_floor', stopFloor)
    if (error && !stopFloor && missingCol(error)) {
      ;({ error } = await client.from('route_progress').delete()
        .eq('route_id', routeId).eq('user_id', userId).eq('shop_id', shopId))
    }
    if (error) { ok = false; console.error('[route progress] remove', error.code, error.message) }
  }
  return ok
}
