import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const { data, error } = await db.from('event_goods').select('event_id,image_url').eq('is_deleted', false)
if (error) throw error
const eventIds = new Set(data.map(row => row.event_id))
const missingImage = data.filter(row => !row.image_url?.trim()).length
console.log(JSON.stringify({ total: data.length, eventsWithData: eventIds.size, missingImage }, null, 2))
