import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const eventResult = await db.from('events').select('*').eq('id', 'ccbb4d38-2865-46a9-8df4-7368661eb5a5').single()
if (eventResult.error) throw eventResult.error
const goodsResult = await db.from('event_goods').select('id,name,kind,image_url,is_deleted').eq('event_id', eventResult.data.id).order('name')
if (goodsResult.error) throw goodsResult.error
const placeResult = await db.from('places').select('id,name,addr').or('name.ilike.%0%SEOUL%,name.ilike.%제로퍼센트%,addr.ilike.%월드컵북로2길 29%')
if (placeResult.error) throw placeResult.error
console.log(JSON.stringify({ event: eventResult.data, goods: goodsResult.data, matchingPlaces: placeResult.data }, null, 2))
