// 2026-09-28 국제전자센터 place 주차 안내를 건물 공식 값으로 교체 (방문 글 기준 → 공식 확인)
// 출처: http://www.kecday.co.kr/bbs/board.php?bo_table=sisul (2026-09-28 브라우저 렌더 텍스트: "일반주차요금 : 무료주차 40분, 추가요금 10분당 1,000원")
// 방문 글에만 있던 "구매 시 할인권" 줄과 "(2026년 1월 방문 기준…)" 표기를 뺀다. 변경 전 행을 backups/ 에 남기고 updated_at 이 같을 때만 바꾼다.
//   node scripts/shops/fixPlaceParking-2026-09-28.mjs [--dry]
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const FIX = [
  { id: '1fee0987-c92d-4bdd-8273-dc4c01207c89', expect: '2026-09-26T14:17:23.400137+00:00', parking: true, parking_note: '주차 가능(유료)\n최초 40분 무료, 이후 10분당 1,000원' },
]
for (const f of FIX) {
  const got = await db.from('places').select('*').eq('id', f.id).single()
  if (got.error) throw got.error
  const cur = got.data
  if (cur.updated_at !== f.expect) { console.log('SKIP_CHANGED', cur.name, cur.updated_at); continue }
  if (dry) { console.log('DRY_UPDATE', cur.name, JSON.stringify(cur.parking_note), '→', JSON.stringify(f.parking_note)); continue }
  await writeFile(`scripts/shops/backups/places-before-2026-09-28-${Date.now()}.json`, JSON.stringify([cur], null, 1))
  const r = await db.from('places').update({ parking: f.parking, parking_note: f.parking_note }).eq('id', cur.id).eq('updated_at', cur.updated_at).select('id').maybeSingle()
  if (r.error) throw r.error
  console.log(r.data ? 'UPDATED' : 'SKIP_CHANGED', cur.name)
}
