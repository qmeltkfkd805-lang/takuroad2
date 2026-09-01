import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

const { data: events, error: eventError } = await db.from('events')
  .select('id,title,start_date,end_date').gte('end_date', '2026-08-31').order('start_date')
if (eventError) throw eventError
const ids = events.map((row) => row.id)
const { data: goods, error: goodsError } = await db.from('event_goods')
  .select('id,event_id,name,kind,price,image_url,is_deleted').in('event_id', ids).eq('is_deleted', false)
if (goodsError) throw goodsError

const counts = new Map()
for (const row of goods) counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1)
const base = (title) => title.replace(/\s*\((?:홍대점|잠실롯데점|잠실점|부산점|부산 서면점|수원점|서울 합정점|신촌점)\)$/, '')
const groups = new Map()
for (const event of events) {
  const key = base(event.title)
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push({ ...event, goodsCount: counts.get(event.id) ?? 0 })
}
console.log(JSON.stringify([...groups.entries()].filter(([, rows]) => rows.length > 1 && rows.some((row) => row.goodsCount > 0) && rows.some((row) => row.goodsCount === 0)).map(([title, rows]) => ({ title, rows })), null, 2))
