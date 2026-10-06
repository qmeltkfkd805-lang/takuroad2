/* 썸네일 만들기 — POST { url: 원본 사진 주소 }
   우리 Supabase 공개 저장소의 사진만 받는다. 이미 있으면 아무것도 안 한다.
   원본을 받아 가로 480px webp 로 줄여 thumbs 버킷에 저장한다 (1년 캐시).
   ⚠️ 먼저 migrations/thumbs_bucket.sql 로 thumbs 버킷을 만들어야 한다. */
import { NextResponse } from 'next/server'
import sharp from 'sharp'
import { serviceClient } from '@/lib/supabase/service'
import { parseStorageUrl, THUMB_BUCKET, THUMB_WIDTH } from '@/lib/utils/thumb'

export const runtime = 'nodejs'
export const maxDuration = 20

const MAX_BYTES = 15 * 1024 * 1024

export async function POST(req: Request) {
  let url = ''
  try { url = String((await req.json())?.url ?? '') } catch { /* noop */ }
  const p = parseStorageUrl(url)
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  // 우리 저장소 주소만 (다른 사이트 사진을 대신 받아 오는 데 쓰이지 않게)
  if (!p || !base || p.origin !== base.replace(/\/$/, '')) {
    return NextResponse.json({ ok: false, reason: 'not-our-storage' }, { status: 400 })
  }
  if (p.path.includes('..')) return NextResponse.json({ ok: false }, { status: 400 })

  const sb = serviceClient()
  const thumbPath = `${p.bucket}/${p.path}.webp`

  // 이미 있으면 끝
  const dir = thumbPath.slice(0, thumbPath.lastIndexOf('/'))
  const name = thumbPath.slice(thumbPath.lastIndexOf('/') + 1)
  const { data: found } = await sb.storage.from(THUMB_BUCKET).list(dir, { search: name, limit: 1 })
  if (found?.some(f => f.name === name)) return NextResponse.json({ ok: true, existed: true })

  // 원본 받기
  const res = await fetch(`${p.origin}/storage/v1/object/public/${p.bucket}/${p.path}`)
  if (!res.ok) return NextResponse.json({ ok: false, reason: `origin-${res.status}` }, { status: 404 })
  const type = res.headers.get('content-type') ?? ''
  if (!type.startsWith('image/')) return NextResponse.json({ ok: false, reason: 'not-image' }, { status: 415 })
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > MAX_BYTES) return NextResponse.json({ ok: false, reason: 'too-big' }, { status: 413 })

  // 줄이기
  let out: Buffer
  try {
    out = await sharp(buf, { failOn: 'none' })
      .rotate()   // 사진의 회전 정보대로 바로 세우기
      .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
      .webp({ quality: 72 })
      .toBuffer()
  } catch {
    return NextResponse.json({ ok: false, reason: 'decode' }, { status: 422 })
  }
  const { error } = await sb.storage.from(THUMB_BUCKET).upload(thumbPath, out, {
    contentType: 'image/webp', cacheControl: '31536000', upsert: false,
  })
  if (error && !/exists|duplicate/i.test(error.message)) {
    return NextResponse.json({ ok: false, reason: 'upload' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, bytes: out.length })
}
