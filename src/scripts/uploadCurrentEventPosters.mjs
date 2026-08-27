import { createClient } from '@supabase/supabase-js'

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const posters = [
  {
    id: 'c0920feb-0d05-49c9-b247-e7fa73257378', key: 'keroro-subst-yongsan-2026', ext: 'webp',
    url: 'https://cdn.popga.co.kr/spot/8501/main/f21a5583-06db-4dde-9833-e52b37ea2c16_1786618599301_thumbnail_MAIN_W480.webp',
  },
  {
    id: 'b025baaa-095c-4d40-b379-709e6f691f07', key: 'pokemon-mureungdowon-2026', ext: 'webp',
    url: 'https://cdn.popga.co.kr/spot/8326/main/a7cf4cb8-5d98-4880-ae2f-f1094e825341_1786026829079_thumbnail_MAIN_W480.webp',
  },
  {
    id: '90ab054c-20a2-4a0b-9ba3-13b00c09ceb8', key: 'ichiban-kuji-musinsa-2026', ext: 'webp',
    url: 'https://cdn.popga.co.kr/spot/8333/main/73935fda-6523-40cc-bc2e-f97541ee6dce_1785834535698_thumbnail_MAIN_W480.webp',
  },
  {
    id: '1c07386a-b07a-4b76-a0c0-462936ebd7ed', key: 'hazbin-hotel-thehyundai-2026', ext: 'jpg',
    url: 'https://pbs.twimg.com/media/HOxiZoDaQAAwAVY.jpg?name=orig',
  },
  {
    id: '6be375a8-c902-46a3-b2a3-4d5d19219bee', key: 'jump-shop-seoul-3-2026', ext: 'jpg',
    url: 'https://pbs.twimg.com/media/HOMntLEbkAE435E.jpg?name=orig',
    officialPost: 'https://x.com/smg_comic/status/2081560207646441942',
  },
]

const output = []
for (const poster of posters) {
  const response = await fetch(poster.url)
  if (!response.ok) throw new Error(`${poster.key}: image download ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.length < 20_000) throw new Error(`${poster.key}: suspicious image size ${bytes.length}`)
  const storagePath = `covers/${poster.key}.${poster.ext}`
  const upload = await db.storage.from('event-goods').upload(storagePath, bytes, {
    contentType: poster.ext === 'jpg' ? 'image/jpeg' : 'image/webp', cacheControl: '31536000', upsert: true,
  })
  if (upload.error) throw upload.error
  const { data } = db.storage.from('event-goods').getPublicUrl(storagePath)
  const patch = { cover_url: data.publicUrl, updated_at: new Date().toISOString() }
  if (poster.officialPost) {
    const current = await db.from('events').select('source_urls').eq('id', poster.id).single()
    if (current.error) throw current.error
    patch.source_urls = [poster.officialPost, ...(current.data.source_urls ?? []).filter((url) => url !== 'https://x.com/smg_comic')]
  }
  const updated = await db.from('events').update(patch).eq('id', poster.id).select('id,title,cover_url,source_urls').single()
  if (updated.error) throw updated.error
  output.push({ ...updated.data, bytes: bytes.length })
}
console.log(JSON.stringify(output, null, 2))
