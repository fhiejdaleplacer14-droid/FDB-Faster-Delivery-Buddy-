// Downloads freely licensed demo product photos from Wikimedia Commons and records their credits.
// Usage: node scripts/fetch-demo-images.mjs [key ...]   (no keys = every entry in demo-images.json)
// An entry may pin an exact file with "file": "File:Name.jpg" instead of a "query".
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'demo-images.json'), 'utf8'))
const outDir = path.join(root, '..', 'backend', 'database', 'seeders', 'demo-images')
const creditsFile = path.join(outDir, 'credits.json')
const API = 'https://commons.wikimedia.org/w/api.php'
const HEADERS = { 'User-Agent': 'FDB-demo-seeder/0.1 (https://github.com/; demo data for a local marketplace)' }

// Licenses that allow commercial use with attribution. NC and ND licenses are never accepted.
const ALLOWED = /^(CC0( 1\.0)?|Public domain|PD[- ].*|CC BY(-SA)? \d(\.\d)?.*)$/i

const strip = (html = '') => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

async function query(params) {
  const url = new URL(API)
  Object.entries({ format: 'json', action: 'query', prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '800', ...params })
    .forEach(([k, v]) => url.searchParams.set(k, v))
  // Commons rate-limits bursts; keep requests well spaced.
  await new Promise((resolve) => setTimeout(resolve, 2000))
  const res = await fetch(url, { headers: HEADERS })
  const text = await res.text()
  if (!res.ok || !text.startsWith('{')) throw new Error(`Commons API refused the request (${res.status}): ${text.slice(0, 80)}`)
  const pages = Object.values(JSON.parse(text).query?.pages ?? {})
  return pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
}

function describe(page) {
  const info = page.imageinfo?.[0]
  const meta = info?.extmetadata ?? {}
  return {
    title: page.title,
    license: strip(meta.LicenseShortName?.value),
    license_url: meta.LicenseUrl?.value ?? null,
    author: strip(meta.Artist?.value) || 'Unknown',
    source: info?.descriptionurl,
    thumb: info?.thumburl,
    mime: info?.mime,
  }
}

async function pick(entry) {
  const pages = entry.file
    ? await query({ titles: entry.file })
    : await query({ generator: 'search', gsrnamespace: '6', gsrlimit: '15', gsrsearch: `${entry.query} filetype:bitmap` })

  return pages.map(describe).find((c) => c.thumb && /image\/(jpeg|png)/.test(c.mime) && ALLOWED.test(c.license))
}

fs.mkdirSync(outDir, { recursive: true })
const credits = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, 'utf8')) : {}
const keys = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(manifest)

for (const key of keys) {
  const chosen = await pick(manifest[key])
  if (!chosen) {
    console.log(`${key}: no freely licensed image found`)
    continue
  }

  const res = await fetch(chosen.thumb, { headers: HEADERS })
  const bytes = Buffer.from(await res.arrayBuffer())
  if (!res.ok || bytes.length > 2_000_000) {
    console.log(`${key}: download failed (${res.status}, ${bytes.length} bytes)`)
    continue
  }

  fs.writeFileSync(path.join(outDir, `${key}.jpg`), bytes)
  credits[key] = { title: chosen.title, author: chosen.author, license: chosen.license, license_url: chosen.license_url, source: chosen.source }
  console.log(`${key}: ${chosen.title} | ${chosen.license} | ${Math.round(bytes.length / 1024)} KB`)
}

fs.writeFileSync(creditsFile, JSON.stringify(credits, null, 2) + '\n')

const lines = Object.entries(credits)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([key, c]) => `| ${key} | [${c.title.replace(/^File:/, '')}](${c.source}) | ${c.author} | ${c.license_url ? `[${c.license}](${c.license_url})` : c.license} |`)
fs.writeFileSync(
  path.join(outDir, 'CREDITS.md'),
  `# Demo image credits\n\nDemo product photos from Wikimedia Commons, used under the licenses below. They are for local and staging demo data only and are not FDB product photography.\n\n| Image | Source | Author | License |\n| --- | --- | --- | --- |\n${lines.join('\n')}\n`,
)
