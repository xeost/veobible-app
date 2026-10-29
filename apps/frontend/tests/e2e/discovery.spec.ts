import { test, expect } from '@playwright/test'

const locales = [
  { lang: 'es', short: 'dosis-diaria', long: 'biblia-en-365-dias', version: 'rv1909', reader: 'leer' },
  { lang: 'en', short: 'daily-dose', long: 'bible-in-365-days', version: 'kjv', reader: 'read' },
  { lang: 'pt', short: 'dose-diaria', long: 'biblia-em-365-dias', version: 'arc', reader: 'ler' },
]

for (const locale of locales) {
  test(`${locale.lang}: discover both collections and enter the reader on mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/${locale.lang}`)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    for (const kind of ['short', 'long'] as const) {
      const path = `/${locale.lang}/${locale[kind]}`
      const card = page.locator(`.home-discover a[href="${path}"]`)
      await expect(card).toBeVisible()
      await card.click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator(`.site-nav a[href="${path}"]`)).toHaveAttribute('aria-current', 'page')
      await page.locator('.breadcrumb').click()
    }
    await page.locator(`#start-reading-${locale.version}`).click()
    await expect(page).toHaveURL(new RegExp(`/${locale.lang}/${locale.reader}/${locale.version}/genesis/1$`))
    await expect(page.locator('#main-content-mobile #verse-1')).toBeVisible()
    for (const control of ['open-sidebar-btn', 'open-bookmarks-btn', 'bible-search-btn', 'typography-settings-btn', 'offline-version-btn']) {
      await expect(page.locator(`#${control}`)).toBeVisible()
    }
    await page.locator('#typography-settings-btn').click()
    await expect(page.getByRole('slider').first()).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('home stays within the viewport at phone, tablet and desktop sizes in both themes', async ({ page }) => {
  await page.goto('/es')
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (let theme = 0; theme < 2; theme++) {
      await expect(page.locator('.home-hero h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.locator('#theme-toggle-btn').click()
    }
  }
})
