import { test, expect, tab, newNote } from './helpers.mjs';

async function waitForServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    }
  });
}

test('App funktioniert ohne Internet', async ({ page, context }) => {
  await page.goto('./');
  await waitForServiceWorker(page);
  await newNote(page, 'Offline-Test', 'geht auch ohne Netz');

  await context.setOffline(true);
  await page.reload();
  await expect(tab(page, 'Notizen')).toBeVisible();
  await expect(page.locator('#main')).toContainText('Offline-Test');
  expect(await page.evaluate(() => document.fonts.check('16px "Bricolage Grotesque"'))).toBe(true);

  // Teilen an die Kladde klappt auch offline
  await page.goto('./?text=' + encodeURIComponent('Offline geteilt'));
  await expect(page.locator('#nb')).toContainText('Offline geteilt');
  await context.setOffline(false);
});

test('Geänderte Dateien kommen auch ohne neue Versionsnummer an', async ({ page }) => {
  await page.goto('./');
  await waitForServiceWorker(page);
  const url = new URL('icons/icon-maskable-512.png', page.url()).href;
  const cached = () => page.evaluate(u => caches.match(u).then(r => r && r.headers.get('content-type')), url);
  // Veraltete Kopie im Offline-Speicher vortäuschen
  await page.evaluate(async url => {
    const name = (await caches.keys()).find(k => k.startsWith('kladde-'));
    await (await caches.open(name)).put(url, new Response('ALT', { headers: { 'Content-Type': 'text/plain' } }));
  }, url);
  expect(await cached()).toBe('text/plain');
  // Die App fordert die Datei an (fetch() verbietet ihre Netzsperre, ein Bild ist erlaubt) …
  const loaded = await page.evaluate(u => new Promise(r => { const i = new Image(); i.onload = () => r(true); i.onerror = () => r(false); i.src = u; }), url);
  expect(loaded, 'erst kommt sofort die gespeicherte (hier: kaputte) Kopie').toBe(false);
  // … und im Hintergrund wird die echte Datei nachgeladen.
  await expect.poll(cached).toBe('image/png');
});
