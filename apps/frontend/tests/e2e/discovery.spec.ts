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
      await page.locator('.site-header .brand-logo').click()
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
    for (const theme of ['Claro', 'Oscuro']) {
      await page.getByRole('button', { name: 'Tu espacio', exact: true }).click()
      await page.getByRole('radio', { name: theme, exact: true }).check()
      const panel = page.getByRole('dialog', { name: 'Visitante' })
      const bounds = await panel.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
      await page.keyboard.press('Escape')
      await expect(page.locator('.home-hero h1')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    }
  }
})

test('clouds animate automatically despite a legacy pause preference', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => localStorage.setItem('veobible-clouds-paused', 'true'))
  await page.goto('/es')
  await expect(page.locator('.cloud-motion')).toHaveCount(0)
  const layer = page.locator('.cloud-left')
  await expect(layer).toHaveCSS('animation-play-state', 'running')
  const start = await layer.evaluate(el => getComputedStyle(el).transform)
  await expect.poll(() => layer.evaluate(el => getComputedStyle(el).transform)).not.toBe(start)
  await page.reload()
  await expect(layer).toHaveCSS('animation-play-state', 'running')
})

test('cropped cloud edges stay outside the scene throughout their boomerangs', async ({ page }) => {
  await page.goto('/es')
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      const safe = await page.locator('.cloud-scene').evaluate((scene, progress) => {
        const bounds = scene.getBoundingClientRect()
        return Array.from(scene.querySelectorAll('.cloud-base, .cloud-left, .cloud-front')).every(layer => {
          for (const animation of layer.getAnimations()) {
            const timing = animation.effect!.getTiming()
            animation.pause()
            animation.currentTime = Number(timing.duration) * progress + Number(timing.delay)
          }
          const rect = layer.getBoundingClientRect()
          if (layer.classList.contains('cloud-left')) return rect.right > bounds.right
          return rect.left < bounds.left && rect.right > bounds.right && rect.top < bounds.top && rect.bottom > bounds.bottom
        })
      }, progress)
      expect(safe).toBe(true)
    }
  }
  await page.screenshot({ path: '/tmp/veobible-cloud-edges.png' })
})
