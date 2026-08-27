import { readFile } from 'node:fs/promises'

const html = await readFile(process.argv[2], 'utf8')
const targetStatus = process.argv[3]
const marker = `status/${targetStatus}`
const at = html.indexOf(marker)
if (at < 0) throw new Error(`Status not found: ${targetStatus}`)

const start = Math.max(0, at - 30000)
const end = Math.min(html.length, at + 90000)
const excerpt = html.slice(start, end)
const decoded = excerpt
  .replaceAll('&quot;', '"')
  .replaceAll('&amp;', '&')
  .replaceAll('&#39;', "'")
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')

const text = [...decoded.matchAll(/<span[^>]*>([^<]{2,})<\/span>/g)]
  .map((match) => match[1].trim())
  .filter(Boolean)
const media = [...new Set([...decoded.matchAll(/https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+/g)].map((match) => match[0]))]

console.log(JSON.stringify({ targetStatus, text: [...new Set(text)], media }, null, 2))
