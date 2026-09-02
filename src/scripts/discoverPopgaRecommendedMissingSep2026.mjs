import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const url = 'https://www.popga.co.kr/list/recommended?periodTypes%5B0%5D=IN_PROGRESS&periodTypes%5B1%5D=READY&sorts%5B0%5D.order=activated_at'
const html = await fetch(url).then((response) => response.text())
const decoded = html.replaceAll('\\"', '"').replaceAll('\\r', '').replaceAll('\\n', ' ')
const matches = [...decoded.matchAll(/"spotDetail":\{"id":(\d+),"title":"([^"]+)","subTitle":"[^"]*","imagePath":"([^"]+)","link":null,"openDate":"([^"]+)","closeDate":"([^"]+)"[\s\S]*?"categoryName":"([^"]+)"/g)]
const candidates = [...new Map(matches.map((match) => [match[1], {
  id: Number(match[1]), title: match[2], image: match[3], start: match[4], end: match[5], category: match[6],
}])).values()].filter((row) => ['애니/캐릭터', '게임'].includes(row.category) && row.end >= '2026-09-02')
const events = await db.from('events').select('id,title,start_date,end_date')
if (events.error) throw events.error
const normalize = (value) => value.toLowerCase().replaceAll(/[^0-9a-z가-힣]/g, '')
for (const candidate of candidates) {
  const related = events.data.filter((event) => event.start_date === candidate.start && event.end_date === candidate.end)
    .map((event) => ({ ...event, score: [...new Set(normalize(candidate.title))].filter((letter) => normalize(event.title).includes(letter)).length }))
    .sort((a, b) => b.score - a.score).slice(0, 3)
  console.log(JSON.stringify({ ...candidate, related }, null, 2))
}
