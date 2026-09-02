import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const html = await fetch('https://popga.co.kr/').then((response) => response.text())
const decoded = html.replaceAll('\\"', '"').replaceAll('\\r', '').replaceAll('\\n', ' ')
const matches = [...decoded.matchAll(/"spotDetail":\{"id":(\d+),"title":"([^"]+)","subTitle":"[^"]*","imagePath":"([^"]+)","link":null,"openDate":"([^"]+)","closeDate":"([^"]+)"[\s\S]*?"categoryName":"([^"]+)"/g)]
const candidates = [...new Map(matches.map((match) => [match[1], {
  id: Number(match[1]), title: match[2], image: match[3], start: match[4], end: match[5], category: match[6],
}])).values()].filter((row) => ['애니/캐릭터', '게임'].includes(row.category) && row.end >= '2026-09-02')

const events = await db.from('events').select('id,title,start_date,end_date')
if (events.error) throw events.error
const normalize = (value) => value.toLowerCase().replaceAll(/[^0-9a-z가-힣]/g, '')
const output = candidates.map((candidate) => {
  const normalized = normalize(candidate.title)
  const related = events.data.filter((event) => {
    const eventTitle = normalize(event.title)
    return (event.start_date === candidate.start && event.end_date === candidate.end)
      && (eventTitle.includes(normalized) || normalized.includes(eventTitle) || normalized.slice(0, 8) === eventTitle.slice(0, 8))
  })
  return { ...candidate, related }
})
console.log(JSON.stringify(output, null, 2))
