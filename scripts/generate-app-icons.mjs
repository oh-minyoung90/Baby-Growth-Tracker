import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Sprout } from 'lucide-react'

// 앱 메뉴와 같은 디자인 토큰·Lucide 새싹을 쓴다. 외부 사진이나 폰트는 사용하지 않는다.
const css = await readFile(new URL('../src/index.css', import.meta.url), 'utf8')
const primary = css.match(/--primary:\s*(#[\da-f]{6})/i)?.[1]
const foreground = css.match(/--on-primary:\s*(#[\da-f]{6})/i)?.[1]
if (!primary || !foreground) throw new Error('앱 아이콘의 디자인 색상을 찾지 못했어요')
const sprout = renderToStaticMarkup(
  createElement(Sprout, {
    x: 96,
    y: 96,
    width: 320,
    height: 320,
    color: foreground,
    strokeWidth: 2,
  }),
)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${primary}"/>${sprout}</svg>\n`
await writeFile(new URL('../public/favicon.svg', import.meta.url), svg)
await mkdir(new URL('../public/icons/', import.meta.url), { recursive: true })
const browser = await chromium.launch({
  channel: process.argv.includes('--chrome') ? 'chrome' : undefined,
})
try {
  const page = await browser.newPage()
  for (const [size, path] of [
    [192, 'icons/app-192.png'],
    [512, 'icons/app-512.png'],
    [180, 'apple-touch-icon.png'],
  ]) {
    const png = await page.evaluate(
      async ({ size, svg, primary }) => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = size
        const context = canvas.getContext('2d')
        const image = new Image()
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        await image.decode()
        // iOS 아이콘은 불투명하게 채운다. 새싹은 maskable 아이콘의 중앙 안전 영역 안에 있다.
        context.fillStyle = primary
        context.fillRect(0, 0, size, size)
        context.drawImage(image, 0, 0, size, size)
        return canvas.toDataURL('image/png').split(',')[1]
      },
      { size, svg, primary },
    )
    await writeFile(new URL(`../public/${path}`, import.meta.url), Buffer.from(png, 'base64'))
  }
} finally {
  await browser.close()
}
process.stdout.write('앱 새싹 아이콘 192·512px와 Apple 180px를 생성했습니다.\n')
