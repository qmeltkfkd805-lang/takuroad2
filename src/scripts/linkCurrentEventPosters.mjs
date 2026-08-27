import { createClient } from '@supabase/supabase-js'
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const rows = [
  ['c0920feb-0d05-49c9-b247-e7fa73257378', 'https://cdn.popga.co.kr/spot/8501/main/f21a5583-06db-4dde-9833-e52b37ea2c16_1786618599301_thumbnail_MAIN_W480.webp'],
  ['b025baaa-095c-4d40-b379-709e6f691f07', 'https://cdn.popga.co.kr/spot/8326/main/a7cf4cb8-5d98-4880-ae2f-f1094e825341_1786026829079_thumbnail_MAIN_W480.webp'],
  ['90ab054c-20a2-4a0b-9ba3-13b00c09ceb8', 'https://cdn.popga.co.kr/spot/8333/main/73935fda-6523-40cc-bc2e-f97541ee6dce_1785834535698_thumbnail_MAIN_W480.webp'],
  ['1c07386a-b07a-4b76-a0c0-462936ebd7ed', 'https://pbs.twimg.com/media/HOxiZoDaQAAwAVY.jpg?name=orig'],
  ['6be375a8-c902-46a3-b2a3-4d5d19219bee', 'https://pbs.twimg.com/media/HOMntLEbkAE435E.jpg?name=orig'],
]
const output = []
for (const [id, cover_url] of rows) {
  const patch = { cover_url, updated_at: new Date().toISOString() }
  if (id === '6be375a8-c902-46a3-b2a3-4d5d19219bee') {
    const current = await db.from('events').select('source_urls').eq('id', id).single()
    if (current.error) throw current.error
    patch.source_urls = ['https://x.com/smg_comic/status/2081560207646441942', ...(current.data.source_urls ?? []).filter((url) => url !== 'https://x.com/smg_comic')]
  }
  const result = await db.from('events').update(patch).eq('id', id).select('id,title,cover_url,source_urls').single()
  if (result.error) throw result.error
  output.push(result.data)
}
console.log(JSON.stringify(output, null, 2))
