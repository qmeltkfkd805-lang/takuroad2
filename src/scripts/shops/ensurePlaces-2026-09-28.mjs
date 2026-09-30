// 2026-09-28(m) 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-28.mjs [--dry]
// 주차 안내 출처: 비트플렉스 bitplex.co.kr/bitplex/parking/ (2026-09-28 브라우저 렌더 텍스트로 확인)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'bitplex-8963797', name: '비트플렉스', place_type: 'SHOPPING_MALL', addr: '서울 성동구 왕십리광장로 17', region: '서울', district: '성동구',
    lat: 37.5619276331273, lng: 127.037920885416, kakao_place_id: '8963797', category_name: '가정,생활 > 상가,아케이드',
    parking: true, parking_note: '주차 가능(유료)\n30분 내 출차 무료(초과 시 입차부터 10분당 1,000원)\n구매 시 무료: 1만원 1시간 · 3만원 2시간 · 5만원 3시간 · 10만원 4시간 · 20만원 5시간\n개별 매장은 이용 매장에서 주차 등록',
    access_note: '왕십리역(왕십리민자역사)과 연결' },
]
const FILL = []

const touched = []
for (const p of NEW) {
  const got = await db.from('places').select('id, name').eq('kakao_place_id', p.kakao_place_id).maybeSingle()
  if (got.error) throw got.error
  if (got.data) { console.log('EXISTS', got.data.id, got.data.name); continue }
  if (dry) { console.log('DRY_INSERT', p.name); continue }
  const r = await db.from('places').insert({ ...p, system_created: false }).select('id, name, slug').single()
  if (r.error) throw r.error
  console.log('INSERTED', r.data.id, r.data.name, r.data.slug)
}
for (const f of FILL) {
  const got = await db.from('places').select('*').eq('kakao_place_id', f.kakao_place_id).single()
  if (got.error) throw got.error
  const cur = got.data
  const patch = {}
  if (cur.parking == null) patch.parking = f.parking
  if (!cur.parking_note) patch.parking_note = f.parking_note
  if (!Object.keys(patch).length) { console.log('KEEP', cur.name); continue }
  touched.push(cur)
  if (dry) { console.log('DRY_FILL', cur.name, Object.keys(patch)); continue }
  const r = await db.from('places').update(patch).eq('id', cur.id).eq('updated_at', cur.updated_at).select('id').maybeSingle()
  if (r.error) throw r.error
  console.log(r.data ? 'FILLED' : 'SKIP_CHANGED', cur.name, Object.keys(patch))
}
if (!dry && touched.length) {
  const file = `scripts/shops/backups/places-before-2026-09-28-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
