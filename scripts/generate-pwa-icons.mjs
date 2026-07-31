import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const outputDirectory = new URL('../public/', import.meta.url)
const colors = {
  ivory: [246, 240, 230],
  sage: [96, 115, 78],
  clay: [191, 117, 81],
}

const crcTable = new Uint32Array(256)
for (let index = 0; index < 256; index += 1) {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  crcTable[index] = value >>> 0
}

function crc32(buffer) {
  let value = 0xffffffff
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  }
  return (value ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

function insideCircle(x, y, centerX, centerY, radius) {
  return (x - centerX) ** 2 + (y - centerY) ** 2 <= radius ** 2
}

function insideTriangle(x, y, a, b, c) {
  const cross = (first, second, point) =>
    (second[0] - first[0]) * (point[1] - first[1]) -
    (second[1] - first[1]) * (point[0] - first[0])
  const first = cross(a, b, [x, y])
  const second = cross(b, c, [x, y])
  const third = cross(c, a, [x, y])
  return (first >= 0 && second >= 0 && third >= 0) || (first <= 0 && second <= 0 && third <= 0)
}

function insideRoundedRectangle(x, y, left, top, right, bottom, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius))
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius))
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2
}

function iconColor(x, y) {
  let color = colors.ivory
  if (insideCircle(x, y, 0.5, 0.5, 0.41)) color = colors.sage

  const houseRoof = insideTriangle(x, y, [0.28, 0.5], [0.5, 0.29], [0.72, 0.5])
  const houseBody = insideRoundedRectangle(x, y, 0.34, 0.46, 0.66, 0.7, 0.028)
  if (houseRoof || houseBody) color = colors.ivory

  if (insideRoundedRectangle(x, y, 0.445, 0.545, 0.555, 0.7, 0.045)) color = colors.clay
  return color
}

function renderIcon(size) {
  const samples = 4
  const pixels = Buffer.alloc((size * 3 + 1) * size)
  let offset = 0

  for (let y = 0; y < size; y += 1) {
    pixels[offset] = 0
    offset += 1
    for (let x = 0; x < size; x += 1) {
      const totals = [0, 0, 0]
      for (let sampleY = 0; sampleY < samples; sampleY += 1) {
        for (let sampleX = 0; sampleX < samples; sampleX += 1) {
          const color = iconColor(
            (x + (sampleX + 0.5) / samples) / size,
            (y + (sampleY + 0.5) / samples) / size,
          )
          totals[0] += color[0]
          totals[1] += color[1]
          totals[2] += color[2]
        }
      }
      const divisor = samples ** 2
      pixels[offset] = Math.round(totals[0] / divisor)
      pixels[offset + 1] = Math.round(totals[1] / divisor)
      pixels[offset + 2] = Math.round(totals[2] / divisor)
      offset += 3
    }
  }

  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(outputDirectory, { recursive: true })
for (const size of [192, 512]) {
  writeFileSync(new URL(`pwa-${size}x${size}.png`, outputDirectory), renderIcon(size))
}
