import { createClient } from '@supabase/supabase-js'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const updates = [
  {
    id: 'a51af964-7c00-45ab-8ecc-92c5498f1260',
    cover_url: 'https://pbs.twimg.com/media/HOOB9b7a8AAWlHV.jpg?name=orig',
  },
  {
    id: '735ef920-b642-4f21-91f5-4e6e7e1869f4',
    cover_url: 'https://yaiba-pr.com/img/ogp-2.jpg',
  },
  {
    id: 'acc326ec-0baf-4f6c-8439-edc9aa486140',
    cover_url: 'https://pbs.twimg.com/media/HNZEqiXbYAAeo0k.jpg?name=orig',
    end_date: '2026-08-27',
  },
]

for (const { id, ...values } of updates) {
  const result = await db
    .from('events')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id,title,cover_url,start_date,end_date')
    .single()

  if (result.error) throw result.error
  console.log(JSON.stringify(result.data))
}
