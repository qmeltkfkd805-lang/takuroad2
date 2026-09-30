// importAnimateFairs0921 로 넣은 잠실롯데점·수원점 행의 shop_id 보정 (2026-09-21)
// 템플릿(하나코 페어) 잠실 행은 샵 연결 상태라 place_addr 가 비어 있었고, 수원은 지점 힌트가 샵명과 달라
// findShopId 가 후보를 못 좁혔다. 실제 주소와 애니메이트 공식 매장명을 헬퍼에 넘겨 다시 찾는다.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { mkdir, writeFile } from 'node:fs/promises'
import { findShopId } from './lib/findShopId.mjs'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const editor = 'e1ffdf30-345a-42c0-8e85-48eb1f9d915d'

const targets = [
  { suffix: '(잠실롯데점)', addr: '서울 송파구 올림픽로 240', nameHint: '애니메이트 잠실롯데점', placeId: null },
  { suffix: '(수원점)', addr: '경기 수원시 팔달구 덕영대로 924', nameHint: '애니메이트 ak플라자 수원점', placeId: 'f33d897a-5a4a-4fcb-a5ef-bfcd2c8c2f47' },
]
const titles = [
  '고깔모자의 아틀리에 animate 페어', '주술회전 3기 「사멸회유」 몸단장 페어 in animate', '매리지 톡신 애니메이션 방송 기념 animate 페어',
  'NEEDY GIRL OVERDOSE animate 페어', '프로젝트 세카이 컬러풀 스테이지! feat. 하츠네 미쿠 Autumn Fair 2026 in animate',
  '은혼 페어 in animate', '마법소녀 마도카☆마기카 발푸르기스의 회천 animate 페어',
]

const rows = []
for (const t of titles) {
  const r = await db.from('events').select('*').ilike('title', `${t}%`).gte('created_at', '2026-09-21')
  if (r.error) throw r.error
  rows.push(...r.data)
}
await mkdir('scripts/event-backups', { recursive: true })
await writeFile(`scripts/event-backups/before-link-animate-fair-shops-0921-${Date.now()}.json`, JSON.stringify(rows, null, 2))

const out = []
for (const target of targets) {
  const shopId = await findShopId(db, { placeId: target.placeId, addr: target.addr, nameHint: target.nameHint })
  if (!shopId) { out.push({ target: target.suffix, shopId: null }); continue }
  for (const row of rows.filter((r) => r.title.endsWith(target.suffix) && !r.shop_id)) {
    const u = await db.from('events').update({
      shop_id: shopId, place_name: null, place_addr: null, place_lat: null, place_lng: null,
      updated_by: editor, updated_at: new Date().toISOString(),
    }).eq('id', row.id).select('id,title,shop_id').single()
    if (u.error) throw u.error
    out.push(u.data)
  }
}
console.log(JSON.stringify(out, null, 2))
