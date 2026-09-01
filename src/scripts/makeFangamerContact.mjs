import sharp from 'sharp'
import { readdir } from 'node:fs/promises'

const dir = 'scripts/work-menu-goods-images/fangamer-summer'
const files = (await readdir(dir)).filter((file) => /^\d\d\.jpg$/.test(file))
const composites = []
for (let index = 0; index < files.length; index += 1) {
  const label = Buffer.from(`<svg width="90" height="38"><rect width="90" height="38" fill="white"/><text x="10" y="28" font-size="25">${files[index]}</text></svg>`)
  const image = await sharp(`${dir}/${files[index]}`).resize(360, 360, { fit: 'contain', background: '#ddd' }).composite([{ input: label }]).jpeg().toBuffer()
  composites.push({ input: image, left: (index % 3) * 360, top: Math.floor(index / 3) * 360 })
}
await sharp({ create: { width: 1080, height: Math.ceil(files.length / 3) * 360, channels: 3, background: '#bbb' } }).composite(composites).jpeg().toFile(`${dir}/contact.jpg`)
