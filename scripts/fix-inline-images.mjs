// 한 번짜리 정리 스크립트 (2026-10-15)
// 커뮤니티 글 본문에 글자(data:image…)로 박힌 사진을 저장소(shop-images)에 올리고, 본문·사진 목록을 주소로 바꾼다.
// 글·링크·사진 위치는 그대로. 바꾸기 전 원본을 scripts/backup-<글id>.json 으로 저장해 둔다.
//
// 실행:  node scripts/fix-inline-images.mjs <글id>
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const id = process.argv[2]
if (!id) { console.error('사용법: node scripts/fix-inline-images.mjs <글id>'); process.exit(1) }

// .env.local 읽기
const env = {}
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('.env.local 에서 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았어요. 프로젝트 폴더(C:\\dev\\takuroad)에서 실행해주세요.'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: post, error } = await sb.from('community_posts').select('id, author_id, content, images').eq('id', id).maybeSingle()
if (error) { console.error('글을 불러오지 못했어요:', error.message); process.exit(1) }
if (!post) { console.error('그 id의 글이 없어요.'); process.exit(1) }

const content = post.content ?? ''
const images = post.images ?? []
const found = new Set()
for (const m of content.matchAll(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=\s]+/g)) found.add(m[0])
for (const i of images) if (typeof i === 'string' && i.startsWith('data:image/')) found.add(i)
if (!found.size) { console.log('글자로 박힌 사진이 없어요. 바꿀 게 없어요.'); process.exit(0) }

const backup = `scripts/backup-${id}.json`
writeFileSync(backup, JSON.stringify(post))
console.log(`원본 백업: ${backup}`)
console.log(`찾은 사진: ${found.size}장 — 업로드 시작`)

const map = new Map()
let n = 0
for (const d of found) {
  n++
  const mm = d.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s)
  if (!mm) { console.error(`  ${n}번 사진 형식을 못 읽었어요 — 건너뜀`); continue }
  const type = mm[1]
  const buf = Buffer.from(mm[2].replace(/\s/g, ''), 'base64')
  const ext = (type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg')
  const path = `community/${post.author_id}/${Date.now()}-${randomBytes(3).toString('hex')}.${ext}`
  const up = await sb.storage.from('shop-images').upload(path, buf, { contentType: type, cacheControl: '31536000' })
  if (up.error) { console.error(`  ${n}번 사진 업로드 실패: ${up.error.message}`); process.exit(1) }
  const pub = sb.storage.from('shop-images').getPublicUrl(path).data.publicUrl
  map.set(d, pub)
  console.log(`  ${n}/${found.size} 업로드 (${Math.round(buf.length / 1024)}KB)`)
}

let next = content
for (const [d, u] of map) next = next.split(d).join(u)
const nextImages = images.map(i => map.get(i) ?? i)

const { error: upErr } = await sb.from('community_posts').update({ content: next, images: nextImages }).eq('id', id)
if (upErr) { console.error('글 저장 실패:', upErr.message, '\n(사진은 올라갔지만 글은 그대로예요. 다시 실행해도 돼요.)'); process.exit(1) }
console.log(`완료! 본문 ${Math.round(content.length / 1024)}KB → ${Math.round(next.length / 1024)}KB, 사진 ${map.size}장 주소로 바꿈`)
