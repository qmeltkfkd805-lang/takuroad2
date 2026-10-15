import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'

/* ============================================================
   링크 미리보기 (2026-10-14) — GET /api/link-preview?url=...
   글에 붙은 링크의 제목·설명·대표 이미지(og:*)를 돌려준다.

   1) link_previews 저장분이 있으면 그대로 (7일 지나면 로그인 사용자 요청 때 새로 읽음)
   2) 없으면 — 로그인한 사용자(글쓰기 중)만 실제로 그 페이지를 읽어 저장
      비로그인 방문자는 저장분만 받는다(남의 주소를 대신 열어보는 기능이라 아무나 못 부르게)

   ⚠️ 서버가 남의 주소를 여는 기능 = SSRF 위험. 그래서
      · http/https, 기본 포트(80/443)만
      · 주소의 IP 를 직접 확인해 내부망(localhost·사설·링크로컬 등)이면 거부
      · 리다이렉트는 직접 따라가며 매번 다시 검사(최대 4번)
      · 6초 시간 제한, HTML 만, 앞쪽 512KB 만 읽음
   ============================================================ */

const FRESH_MS = 7 * 24 * 60 * 60 * 1000
const MAX_BYTES = 512 * 1024
/* 노션·인스타처럼 화면을 자바스크립트로 그리는 사이트는, '미리보기 봇'으로 알아보는 요청에만
   그 페이지의 제목·이미지(og)를 넣어 준다. 일반 요청엔 사이트 공통 소개(예: 'Notion | Where teams…')만 준다.
   네이버·카톡이 노션 카드를 제대로 보여주는 것도 그 때문.
   1차: 우리 봇 이름 / 2차: 아이메시지처럼 널리 알려진 미리보기 봇 표기를 덧붙여 한 번 더. */
const UAS = [
  'Mozilla/5.0 (compatible; TakuroadBot/1.0; +https://www.takuroad.kr)',
  'Mozilla/5.0 (compatible; TakuroadBot/1.0; +https://www.takuroad.kr) facebookexternalhit/1.1 Facebot Twitterbot/1.0',
]

type Preview = { url: string; ok: boolean; title: string | null; description: string | null; image: string | null; siteName: string | null }

function normalize(raw: string): string | null {
  try {
    const u = new URL(raw.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (u.username || u.password) return null
    u.hash = ''
    return u.toString().slice(0, 2000)
  } catch { return null }
}

function isPrivateIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224
  }
  const v = ip.toLowerCase()
  if (v === '::' || v === '::1') return true
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('ff')
}

async function assertPublic(u: URL) {
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('bad protocol')
  if (u.port && u.port !== '80' && u.port !== '443') throw new Error('bad port')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('bad host')
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('private address')
}

async function readLimited(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array()
  const chunks: Uint8Array[] = []
  let size = 0
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value); size += value.length
  }
  try { await reader.cancel() } catch { /* noop */ }
  const out = new Uint8Array(Math.min(size, MAX_BYTES))
  let off = 0
  for (const c of chunks) { const take = Math.min(c.length, out.length - off); out.set(c.subarray(0, take), off); off += take; if (off >= out.length) break }
  return out
}

function decodeHtml(bytes: Uint8Array, contentType: string): string {
  let charset = /charset=([\w-]+)/i.exec(contentType)?.[1]
  if (!charset) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096))
    charset = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
  }
  try { return new TextDecoder((charset || 'utf-8').toLowerCase()).decode(bytes) }
  catch { return new TextDecoder('utf-8').decode(bytes) }
}

function unescape(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return '' } })
    .replace(/&#(\d+);/g, (_, d) => { try { return String.fromCodePoint(Number(d)) } catch { return '' } })
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

function parseMeta(html: string, baseUrl: string) {
  const head = html.slice(0, 300_000)
  const meta: Record<string, string> = {}
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase()
    const val = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (key && val != null && !(key in meta)) meta[key] = unescape(val)
  }
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const title = meta['og:title'] || meta['twitter:title'] || (titleTag ? unescape(titleTag) : '') || null
  const description = meta['og:description'] || meta['twitter:description'] || meta['description'] || null
  let image = meta['og:image:secure_url'] || meta['og:image'] || meta['og:image:url'] || meta['twitter:image'] || meta['twitter:image:src'] || null
  if (image) {
    try { const iu = new URL(image, baseUrl); image = iu.protocol === 'http:' || iu.protocol === 'https:' ? iu.toString() : null } catch { image = null }
  }
  const siteName = meta['og:site_name'] || null
  const ogUrl = meta['og:url'] || null
  const cut = (s: string | null, n: number) => (s ? s.slice(0, n) : null)
  return { title: cut(title, 300), description: cut(description, 500), image: cut(image, 2000), siteName: cut(siteName, 120), ogUrl }
}

/* 받은 og 가 '그 페이지'가 아니라 사이트 공통 소개인지 — og:url 이 전혀 다른 사이트를 가리키면 공통 소개로 본다
   (노션: 페이지는 xxx.notion.site 인데 og:url 은 www.notion.com) */
const baseDomain = (h: string) => h.replace(/^www\./, '').split('.').slice(-2).join('.')
function looksGeneric(pageUrl: string, ogUrl: string | null): boolean {
  if (!ogUrl) return false
  try {
    const a = new URL(pageUrl).hostname, b = new URL(ogUrl, pageUrl).hostname
    return baseDomain(a) !== baseDomain(b)
  } catch { return false }
}

async function fetchOnce(url: string, ua: string): Promise<(Omit<Preview, 'url'> & { generic: boolean }) | null> {
  let current = new URL(url)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 6000)
  try {
    for (let hop = 0; hop < 5; hop++) {
      await assertPublic(current)
      const res = await fetch(current, {
        redirect: 'manual', signal: ctrl.signal, cache: 'no-store',
        headers: { 'User-Agent': ua, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'ko,en;q=0.8' },
      })
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location')
        if (!loc) break
        current = new URL(loc, current)
        continue
      }
      const ct = res.headers.get('content-type') ?? ''
      if (!res.ok || !/text\/html|application\/xhtml/i.test(ct)) break
      const html = decodeHtml(await readLimited(res), ct)
      const m = parseMeta(html, current.toString())
      const { ogUrl, ...rest } = m
      return { ok: !!(m.title || m.description || m.image), ...rest, generic: looksGeneric(current.toString(), ogUrl) }
    }
  } catch { /* 실패 */ } finally { clearTimeout(timer) }
  return null
}

async function fetchPreview(url: string): Promise<Omit<Preview, 'url'>> {
  for (const ua of UAS) {
    const r = await fetchOnce(url, ua)
    if (r && r.ok && !r.generic) { const { generic: _g, ...p } = r; return p }
  }
  // 끝까지 사이트 공통 소개뿐이면 카드를 만들지 않는다(엉뚱한 카드보다 링크만 있는 게 낫다)
  return { ok: false, title: null, description: null, image: null, siteName: null }
}

export async function GET(req: NextRequest) {
  const url = normalize(req.nextUrl.searchParams.get('url') ?? '')
  if (!url) return NextResponse.json({ error: '주소가 올바르지 않아요' }, { status: 400 })

  const svc = serviceClient()
  const { data: cached } = await svc.from('link_previews')
    .select('url, ok, title, description, image_url, site_name, fetched_at').eq('url', url).maybeSingle()
  const toOut = (r: any): Preview => ({ url, ok: !!r.ok, title: r.title ?? null, description: r.description ?? null, image: r.image_url ?? null, siteName: r.site_name ?? null })

  const fresh = cached && Date.now() - new Date((cached as any).fetched_at).getTime() < FRESH_MS
  if (fresh) return NextResponse.json(toOut(cached), { headers: { 'Cache-Control': 'public, max-age=3600' } })

  // 새로 읽는 건 로그인한 사용자만
  const userSupabase = await createServerClient()
  const { data: { user } } = await userSupabase.auth.getUser()
  if (!user) return cached ? NextResponse.json(toOut(cached)) : NextResponse.json({ url, ok: false, title: null, description: null, image: null, siteName: null })

  const p = await fetchPreview(url)
  const row = { url, ok: p.ok, title: p.title, description: p.description, image_url: p.image, site_name: p.siteName, fetched_at: new Date().toISOString() }
  const { error } = await svc.from('link_previews').upsert(row, { onConflict: 'url' })
  if (error) console.error('[link-preview] 저장 실패', error.code, error.message)
  return NextResponse.json(toOut(row))
}
