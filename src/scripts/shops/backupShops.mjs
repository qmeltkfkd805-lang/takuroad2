// 샵 작업 전용 백업 — shops·places(샵이 속한 것)·shop_tags 전체를 페이지 단위로 읽어 scripts/shops/backups/ 에 저장
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

export async function readAll(table, select = '*', filter = (q) => q, order = 'id') {
  const rows = []
  for (let from = 0; ; from += 500) {
    const r = await filter(db.from(table).select(select)).order(order).range(from, from + 499)
    if (r.error) throw r.error
    rows.push(...r.data)
    if (r.data.length < 500) break
  }
  return rows
}

const shops = await readAll('shops')
const places = await readAll('places')
const shopTags = await readAll('shop_tags', '*', (q) => q, 'shop_id')
await mkdir('scripts/shops/backups', { recursive: true })
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
const file = `scripts/shops/backups/shops-${process.argv[2] ?? 'snapshot'}-${stamp}.json`
await writeFile(file, JSON.stringify({ shops, places, shopTags }, null, 1))
console.log(file, 'shops', shops.length, 'places', places.length, 'shop_tags', shopTags.length)
