import { test, expect } from '@playwright/test'
// These checks use the two-publication fixture documented in website-publication.md.
// They are opt-in because regular site builds contain the real publication list.
test('static video pages contain the Bible passage, canonical URL and a click-to-play video', async ({
  page,
  request
}) => {
  test.skip(
    process.env.WEBSITE_FIXTURE !== '1',
    'Requires the website build fixture'
  )
  const path = '/es/dosis-diaria/rv1909/en-el-principio'
  const html = await request.get(path)
  expect(html.status()).toBe(200)
  expect(await html.text()).toContain('En el principio crió Dios')
  expect(html.headers()['x-robots-tag'] ?? '').not.toContain('noindex')
  await page.route('https://i.ytimg.com/**', (route) => route.abort())
  await page.route('https://www.youtube-nocookie.com/**', (route) =>
    route.fulfill({
      body: '<html><body>Video</body></html>',
      contentType: 'text/html'
    })
  )
  await page.goto(path)
  await expect(
    page.getByRole('heading', { name: 'En el principio', exact: true })
  ).toBeVisible()
  await expect(page.locator('iframe')).toHaveCount(0)
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `https://veobible.com${path}`
  )
  await page.getByRole('button', { name: 'Ver video: En el principio' }).click()
  await expect(page.locator('iframe')).toHaveAttribute(
    'src',
    /youtube-nocookie.com\/embed\/abcdefghijk/
  )
  await page.screenshot({
    path: '/tmp/veobible-website-video.png',
    fullPage: true
  })
  const long = await request.get('/es/biblia-en-365-dias/rv1909/dia-001')
  const text = await long.text()
  expect(text).toContain('Génesis')
  expect(text).toContain('acabados los cielos')
  const index = await request.get('/bible-data/es/rv1909/index.json')
  expect((await index.json()).books[0].video).toBe(
    'https://www.youtube.com/watch?v=abcdefghijk'
  )
  const sitemap = await (await request.get('/sitemap.xml')).text()
  expect(sitemap).toContain(path)
  expect(sitemap).not.toContain('/es/leer/rv1909/genesis/1')
  const reader = await request.get('/es/leer/rv1909/genesis/1')
  expect(reader.headers()['x-robots-tag']).toContain('noindex')
})
