import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const id = '5683c48f-79f0-49bd-9723-b9df17fd0f54'
const reservationUrl = 'https://www.mcomics.co.kr/shop/category/REBORN'

const { data, error } = await supabase
  .from('events')
  .update({
    entry_info: '사전예약 후 입장',
    ticket_urls: [reservationUrl],
  })
  .eq('id', id)
  .select('id,title,entry_info,ticket_urls,source_urls')
  .single()

if (error) throw error
console.log(JSON.stringify(data, null, 2))
