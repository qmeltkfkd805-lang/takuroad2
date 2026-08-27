import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const today = '2026-08-25'
const { data: events, error: eventError } = await db.from('events')
  .select('id,title,start_date,end_date,source_urls').gte('end_date', today).order('start_date')
if (eventError) throw eventError
const { data: goods, error: goodsError } = await db.from('event_goods').select('event_id').eq('is_deleted', false)
if (goodsError) throw goodsError
const filled = new Set(goods.map(row => row.event_id))
console.log(JSON.stringify(events.filter(event => !filled.has(event.id)), null, 2))
