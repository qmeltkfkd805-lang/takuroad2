// 2026-09-28(n) 샵 등록분 건물 매핑용 places — kakao_place_id 로 있으면 재사용, 없을 때만 만든다.
// 기존 places 는 비어 있는 parking/parking_note 만 채운다(덮어쓰기 없음). 변경 전 행을 backups/ 에 남긴다.
//   node scripts/shops/ensurePlaces-2026-09-28-n.mjs [--dry]
// 주차 안내 출처: 동성로 스파크 d-spark.kr/open_content/etc/faq.php?cate=c (자주하는질문 주차, 2026-09-28 브라우저 렌더 텍스트로 확인)
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFile } from 'fs/promises'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const dry = process.argv.includes('--dry')

const NEW = [
  { slug: 'dongseongro-spark-1042593619', name: '동성로 스파크', place_type: 'SHOPPING_MALL', addr: '대구 중구 동성로6길 61', region: '대구', district: '중구',
    lat: 35.868752114075086, lng: 128.59865816774266, kakao_place_id: '1042593619', category_name: '가정,생활 > 복합쇼핑몰',
    parking: true, parking_note: '주차 가능(유료)\n기본 30분 2,400원, 이후 10분당 1,000원\n스파크몰 입점 매장 구매 시: 5만원 이상 1시간 무료 · 10만원 이상 2시간\n테마파크 이용·매장 구매 합산 하루 최대 3시간',
    access_note: '중앙로역 2번 출구 도보 8분, 반월당역 10번 출구 도보 9분' },
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
  const file = `scripts/shops/backups/places-before-2026-09-28-n-${Date.now()}.json`
  await writeFile(file, JSON.stringify(touched, null, 1))
  console.log('backup', file)
}
