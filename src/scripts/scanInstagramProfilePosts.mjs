import { readFile } from 'node:fs/promises'

const [file, limitText = '35'] = process.argv.slice(2)
if (!file) throw new Error('profile HTML path is required')

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
const html = await readFile(file, 'utf8')
const keys = [...html.matchAll(/ig_cache_key=([A-Za-z0-9%]+)/g)].map((match) => match[1])
const ids = [...new Set(keys.map((key) => Buffer.from(decodeURIComponent(key), 'base64').toString()))]

for (const id of ids.slice(0, Number(limitText))) {
  let value = BigInt(id)
  let code = ''
  while (value) {
    code = alphabet[Number(value % 64n)] + code
    value /= 64n
  }

  try {
    const response = await fetch(`https://www.instagram.com/p/${code}/embed/captioned/`)
    const postHtml = await response.text()
    const match = postHtml.match(/class="Caption">([\s\S]*?)<\/div>/)
    if (!match) continue

    const caption = match[1]
      .replaceAll('<br />', ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
      .replaceAll('&amp;', '&')
      .replace(/\s+/g, ' ')
      .trim()

    console.log(`${code} | ${caption.slice(0, 500)}`)
  } catch {
    // Ignore individual unavailable posts and continue scanning official public posts.
  }
}
