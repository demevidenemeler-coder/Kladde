import { readFile } from 'node:fs/promises';
import { test, expect, seed, tab } from './helpers.mjs';

const NOTES = [
  { id: 'n1', kind: 'note', title: 'Tagebuch', body: 'Heute war schön', tags: ['privat'], checklist: [] },
  { id: 'c1', kind: 'counter', title: 'Sport', date: '2026-09-01', mode: 'since', note: '' },
];

async function exportBackup(page, password) {
  await tab(page, 'Einstellungen').click();
  if (password) {
    await page.locator('[data-flag="backupEncrypt"]').click();
    await expect(page.locator('[data-flag="backupEncrypt"]')).toHaveAttribute('aria-checked', 'true');
  }
  const download = page.waitForEvent('download');
  await page.locator('#bsave').click();
  if (password) {
    await page.locator('#pw1').fill(password);
    await page.locator('#pw2').fill(password);
    await page.locator('.dlg .yes').click();
  }
  const d = await download;
  return { name: d.suggestedFilename(), text: await readFile(await d.path(), 'utf8') };
}

async function importBackup(page, file, password) {
  await tab(page, 'Einstellungen').click();
  await page.locator('#file').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) });
  if (password) {
    await page.locator('#pw1').fill(password);
    await page.locator('.dlg .yes').click();
  }
  await expect(page.locator('.dlg h3')).toHaveText('Sicherung laden?');
  await page.locator('.dlg .yes').click();
}

test('Sicherung speichern und auf leerem Gerät wieder laden', async ({ page, browser }) => {
  await seed(page, NOTES);
  const file = await exportBackup(page);
  expect(file.name).toMatch(/^kladde-sicherung-2026-09-30-\d{4}\.json$/);
  const data = JSON.parse(file.text);
  expect(data.app).toBe('kladde');
  expect(data.items.map(i => i.id).sort()).toEqual(['c1', 'n1']);

  // „Neues Handy“: frischer Browser ohne Daten
  const ctx = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const fresh = await ctx.newPage();
  await fresh.goto('./');
  await importBackup(fresh, file);
  await expect(fresh.locator('.toast')).toContainText('2 Einträge übernommen');
  await tab(fresh, 'Notizen').click();
  await expect(fresh.locator('#main')).toContainText('Tagebuch');
  await tab(fresh, 'Zähler').click();
  await expect(fresh.locator('#main')).toContainText('Sport');
  await ctx.close();
});

test('Verschlüsselte Sicherung: nur mit richtigem Passwort lesbar', async ({ page }) => {
  await seed(page, NOTES);
  const file = await exportBackup(page, 'geheim-1234');
  expect(file.name).toContain('-verschluesselt');
  expect(file.text).not.toContain('Tagebuch');
  expect(file.text).not.toContain('Heute war schön');
  const enc = JSON.parse(file.text);
  expect(enc).toMatchObject({ app: 'kladde', enc: 1, kdf: 'PBKDF2-SHA256' });

  // Auf dem gleichen Gerät löschen und neu laden
  await page.evaluate(() => { localStorage.clear(); return new Promise(r => { const q = indexedDB.deleteDatabase('kladde'); q.onsuccess = q.onerror = q.onblocked = () => r(); }); });
  await page.reload();
  await expect(page.locator('#main')).not.toContainText('Tagebuch');

  await tab(page, 'Einstellungen').click();
  await page.locator('#file').setInputFiles({ name: file.name, mimeType: 'application/json', buffer: Buffer.from(file.text) });
  await page.locator('#pw1').fill('falsch-falsch');
  await page.locator('.dlg .yes').click();
  await expect(page.locator('#pwe')).toHaveText('Falsches Passwort oder beschädigte Datei.');
  await page.locator('#pw1').fill('geheim-1234');
  await page.locator('.dlg .yes').click();
  await expect(page.locator('.dlg h3')).toHaveText('Sicherung laden?');
  await page.locator('.dlg .yes').click();
  await tab(page, 'Notizen').click();
  await expect(page.locator('#main')).toContainText('Tagebuch');
});

test('Beim Laden gewinnt die neuere Fassung eines Eintrags', async ({ page }) => {
  await seed(page, [{ id: 'n1', kind: 'note', title: 'Aktuell', body: 'neu', tags: [], checklist: [], updatedAt: 2000 }]);
  const old = { app: 'kladde', items: [
    { id: 'n1', kind: 'note', title: 'Veraltet', body: 'alt', tags: [], checklist: [], updatedAt: 1000 },
    { id: 'n2', kind: 'note', title: 'Nur in der Datei', body: '', tags: [], checklist: [], updatedAt: 1000 },
  ] };
  await importBackup(page, { name: 'alt.json', text: JSON.stringify(old) });
  await expect(page.locator('.toast')).toContainText('1 Einträge übernommen');
  await tab(page, 'Notizen').click();
  await expect(page.locator('#main')).toContainText('Aktuell');
  await expect(page.locator('#main')).toContainText('Nur in der Datei');
  await expect(page.locator('#main')).not.toContainText('Veraltet');
});

test('Vor dem Laden entsteht eine automatische Kopie', async ({ page }) => {
  await seed(page, NOTES);
  await importBackup(page, { name: 'x.json', text: JSON.stringify({ app: 'kladde', items: [{ id: 'n9', kind: 'note', title: 'Neu', body: '', tags: [], checklist: [], updatedAt: 5 }] }) });
  await tab(page, 'Einstellungen').click();
  await expect(page.locator('#snaps')).toContainText('Vor dem Laden einer Sicherung');
});

test('Schadcode in einer Sicherungsdatei wird nicht ausgeführt', async ({ page }) => {
  await page.goto('./');
  const evil = { app: 'kladde', items: [{
    id: 'n1', kind: 'note', title: 'Harmlos', tags: [], checklist: [], updatedAt: 5,
    html: '<div>Text</div><img src="x" onerror="window.__boom=1"><script>window.__boom=2</script><a href="javascript:window.__boom=3" onclick="window.__boom=4">Link</a>',
  }] };
  await importBackup(page, { name: 'boese.json', text: JSON.stringify(evil) });
  await tab(page, 'Notizen').click();
  await page.locator('#main').getByText('Harmlos').click();
  await expect(page.locator('#nb')).toContainText('Text');
  await page.locator('#nb').getByText('Link').click();
  const html = await page.locator('#nb').innerHTML();
  expect(html).not.toMatch(/<img|<script|<a |onerror|onclick|javascript:/i);
  expect(await page.evaluate(() => window.__boom)).toBeUndefined();
});

test('Kaputte Datei wird abgelehnt, ohne Daten zu verändern', async ({ page }) => {
  await seed(page, NOTES);
  await tab(page, 'Einstellungen').click();
  await page.locator('#file').setInputFiles({ name: 'kaputt.json', mimeType: 'application/json', buffer: Buffer.from('{nicht json') });
  await expect(page.locator('.toast')).toContainText('keine gültige Sicherungsdatei');
  await tab(page, 'Notizen').click();
  await expect(page.locator('#main')).toContainText('Tagebuch');
});
