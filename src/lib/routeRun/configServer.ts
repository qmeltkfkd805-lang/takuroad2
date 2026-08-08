/* 검증 설정 서버 조회 — 짧은 TTL 캐시 + 실패 시 안전 기본값. 판정은 항상 서버가 이 값으로 수행. */
import type { SupabaseClient } from '@supabase/supabase-js'
import { parseConfigRows, DEFAULT_CONFIG } from './config'
import type { VerifyConfig } from './types'

let cache: { cfg: VerifyConfig; at: number } | null = null
const TTL_MS = 60_000

export async function fetchVerifyConfig(client: SupabaseClient): Promise<VerifyConfig> {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) return cache.cfg
  try {
    const { data, error } = await client.from('route_verify_config').select('key, value')
    if (error) throw error
    const cfg = parseConfigRows(data as any)
    cache = { cfg, at: now }
    return cfg
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}
