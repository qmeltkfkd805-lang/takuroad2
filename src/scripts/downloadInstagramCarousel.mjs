import { mkdir, readFile, writeFile } from 'node:fs/promises'

const [htmlPath, outputDir, prefix = 'image'] = process.argv.slice(2)
if (!htmlPath || !outputDir) throw new Error('htmlPath and outputDir are required')

const html = (await readFile(htmlPath, 'utf8'))
  .replace(/\\+\//g, '/')
  .replace(/\\+u00253D/g, '%3D')
  .replace(/\\+u0026/g, '&')

const urls = [...html.matchAll(/display_url\\+":\\+"(https:\/\/[^\\"]+)/g)].map((match) => match[1])
const unique = [...new Set(urls)]
await mkdir(outputDir, { recursive: true })

const results = []
for (let index = 0; index < unique.length; index += 1) {
  const url = unique[index]
  const response = await fetch(url)
  if (!response.ok) throw new Error(`download failed: ${response.status} ${url}`)
  const file = `${outputDir}/${prefix}-${String(index + 1).padStart(2, '0')}.jpg`
  await writeFile(file, Buffer.from(await response.arrayBuffer()))
  results.push({ file, bytes: Number(response.headers.get('content-length') ?? 0), url })
}

console.log(JSON.stringify(results, null, 2))
