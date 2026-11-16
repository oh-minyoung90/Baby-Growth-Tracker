import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

// 공개 접속 정보만 검사한다. API 키·로그인 정보·아이 기록은 조회하지 않는다.
const config = JSON.parse(
  await readFile(new URL('../deployment/production.json', import.meta.url), 'utf8'),
)
const base = new URL(config.url)
assert.equal(base.protocol, 'https:', '운영 주소는 HTTPS여야 합니다')
const expectedHeaders = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
}

async function response(path, type) {
  const result = await fetch(new URL(path, base), { signal: AbortSignal.timeout(20_000) })
  assert.equal(result.status, 200, `${path}: HTTP 200 응답 확인 실패`)
  assert.match(result.headers.get('content-type') ?? '', type, `${path}: Content-Type 확인 실패`)
  for (const [name, value] of Object.entries(expectedHeaders)) {
    assert.equal(result.headers.get(name), value, `${path}: ${name} 확인 실패`)
  }
  return result
}

const html = await (await response('/', /text\/html/)).text()
assert.match(html, /rel="manifest"[^>]+href="\/manifest.webmanifest"/)
assert.match(html, /rel="apple-touch-icon"/)
for (const path of ['/sleep', '/meals/recipes/new']) {
  const deepHtml = await (await response(path, /text\/html/)).text()
  assert.equal(deepHtml, html, `${path}: SPA 진입점 확인 실패`)
}

const manifest = await (
  await response('/manifest.webmanifest', /application\/manifest\+json/)
).json()
assert.equal(manifest.id, '/')
assert.equal(manifest.start_url, '/')
assert.equal(manifest.scope, '/')
assert.equal(manifest.display, 'standalone')
assert.equal(manifest.name, 'MyBabyLog')
assert.equal(manifest.short_name, 'MyBabyLog')
assert.ok(manifest.icons.some((icon) => icon.purpose.includes('maskable')))
for (const icon of [...manifest.icons, { src: '/apple-touch-icon.png', sizes: '180x180' }]) {
  const bytes = Buffer.from(await (await response(icon.src, /image\/png/)).arrayBuffer())
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
  assert.equal(`${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`, icon.sizes)
}

const entry = html.match(/<script[^>]+src="([^\"]+\.js)"/)
assert.ok(entry, '운영 JavaScript 진입점을 찾지 못했습니다')
const js = await (await response(entry[1], /javascript/)).text()
assert.ok(js.includes(`https://${config.supabaseProjectRef}.supabase.co`), '운영 DB 연결 확인 실패')
assert.ok(
  !js.includes('https://mahhdygzpzqvfklxvqed.supabase.co'),
  'dev DB가 배포 번들에 포함됐습니다',
)
process.stdout.write(`운영 점검 통과: ${base.origin}\n`)
process.stdout.write(
  '보안 헤더·하위 경로·설치 정보·아이콘·운영 DB 연결 확인 (로그인/메일·실제 기기 검증은 별도)\n',
)
