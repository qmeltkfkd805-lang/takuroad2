import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '../.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const T = ['check_ins','event_submissions','events','reviews','route_progress','route_session_visits','route_shops','shop_ai_summaries','shop_events','shop_goods_categories','shop_products','shop_tags','shop_verify_requests','pilgrimage_list_shops','saved_shops','shop_amenity_links','shop_highlights','shop_images','shop_info_confirmations','shop_suggestions','shop_change_logs']
for (const id of process.argv.slice(2)) {
  const out = []
  for (const t of T) { const r = await db.from(t).select('shop_id', { count: 'exact', head: true }).eq('shop_id', id); if (r.error) out.push(t + ':ERR'); else if (r.count) out.push(t + ':' + r.count) }
  const c = await db.from('search_click_logs').select('target_id', { count: 'exact', head: true }).eq('target_id', id); if (c.count) out.push('search_click_logs:' + c.count)
  console.log(id.slice(0, 8), out.join(' '))
}
