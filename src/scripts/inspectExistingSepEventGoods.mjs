import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '../.env.local' })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const ids = [
  '4c433b45-79d5-473a-b2d8-df4636f1ee37',
  'a409e6e2-abd7-4cc6-8c9b-b9459ec8868e',
  '6be375a8-c902-46a3-b2a3-4d5d19219bee',
]
for (const id of ids) {
  const event = await db.from('events').select('*').eq('id', id).single()
  if (event.error) throw event.error
  const goods = await db.from('event_goods').select('id,name,kind,price,image_url,is_deleted').eq('event_id', id).order('name')
  if (goods.error) throw goods.error
  console.log(JSON.stringify({ event: event.data, goods: goods.data }, null, 2))
}
