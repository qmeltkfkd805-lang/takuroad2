import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const airport = `주차 가능(유료)
소형차 최초 30분 600원
이후 10분당 200원
P1 1일 최대: 월~목 10,000원 / 금~일·공휴일 15,000원
P2 장기주차장 1일 최대: 월~목 9,000원 / 금~일·공휴일 13,500원
입차 후 최초 10분 무료`

const donghwa = `주차 가능(600대)
주차요금 무료`

for (const [id, parking_note] of [
  ['33ec13e3-7b51-4c8d-9b0f-78675afff6d9', airport],
  ['fb6b3be6-728c-4281-bf5b-c24544994d96', donghwa],
]) {
  const { error } = await db.from('events').update({ parking: true, parking_note, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}

for (const [kakao_place_id, parking_note] of [
  ['10808261', airport],
  ['259569525', donghwa],
]) {
  const { error } = await db.from('places').update({ parking: true, parking_note, updated_at: new Date().toISOString() }).eq('kakao_place_id', kakao_place_id)
  if (error) throw error
}

const { data, error } = await db.from('events')
  .select('title,parking,parking_note')
  .in('id', ['33ec13e3-7b51-4c8d-9b0f-78675afff6d9', 'fb6b3be6-728c-4281-bf5b-c24544994d96'])
if (error) throw error
console.log(JSON.stringify(data, null, 2))
