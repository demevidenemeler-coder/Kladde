import { test, expect, seed, tab, newNote } from './helpers.mjs';

test('App startet und zeigt alle Bereiche', async ({ page }) => {
  await page.goto('./');
  for (const name of ['Notizen', 'Zähler', 'Träume', 'Verträge', 'Einstellungen']) {
    await expect(tab(page, name)).toBeVisible();
  }
});

test('Notiz bleibt nach dem Neuladen erhalten', async ({ page }) => {
  await page.goto('./');
  await newNote(page, 'Einkaufsliste', 'Milch und Brot');
  await page.reload();
  await expect(page.locator('#main')).toContainText('Einkaufsliste');
  await expect(page.locator('#main')).toContainText('Milch und Brot');
});

test('Einträge aus dem alten Speicher werden übernommen', async ({ page }) => {
  await seed(page, [{ id: 'n1', kind: 'note', title: 'Alte Notiz', body: 'von früher', tags: [], checklist: [] }]);
  await expect(page.locator('#main')).toContainText('Alte Notiz');
  // Jetzt liegt sie auch im Hauptspeicher: ohne den alten Speicher noch da.
  await page.evaluate(() => localStorage.removeItem('kladde.v1'));
  await page.reload();
  await expect(page.locator('#main')).toContainText('Alte Notiz');
});

test('Gelöschte Notiz landet im Papierkorb und lässt sich wiederherstellen', async ({ page }) => {
  await seed(page, [{ id: 'n1', kind: 'note', title: 'Wegwerfen', body: 'x', tags: [], checklist: [] }]);
  await page.locator('#main').getByText('Wegwerfen').click();
  await page.locator('#del').click();
  await expect(page.locator('.toast')).toContainText('Notiz gelöscht');
  await expect(page.locator('#main')).not.toContainText('Wegwerfen');

  await tab(page, 'Einstellungen').click();
  await page.locator('[data-restore="n1"]').click();
  await tab(page, 'Notizen').click();
  await expect(page.locator('#main')).toContainText('Wegwerfen');
});

test('Suche findet Notizen', async ({ page }) => {
  await seed(page, [
    { id: 'n1', kind: 'note', title: 'Urlaub', body: 'Koffer packen', tags: [], checklist: [] },
    { id: 'n2', kind: 'note', title: 'Arbeit', body: 'Bericht schreiben', tags: [], checklist: [] },
  ]);
  await page.locator('#q').fill('koffer');
  await expect(page.locator('#main')).toContainText('Urlaub');
  await expect(page.locator('#main')).not.toContainText('Arbeit');
});

test('Zähler rechnet die Tage richtig', async ({ page }) => {
  await seed(page, [{ id: 'c1', kind: 'counter', title: 'Rauchfrei', date: '2026-01-01', mode: 'since', note: '' }]);
  await tab(page, 'Zähler').click();
  const main = page.locator('#main');
  await expect(main).toContainText('272');
  await expect(main).toContainText('8 Monate, 29 Tage');
  await expect(main).toContainText('Nächster Meilenstein: 300 Tage, in 28 Tagen');
});

test('Vertrag: Kündigungsfrist wird richtig berechnet', async ({ page }) => {
  // Beginn 1.1.2025, 24 Monate, 3 Monate Frist → Ende 31.12.2026, letzter Kündigungstag 30.9.2026 (= heute im Test)
  await seed(page, [
    { id: 'k1', kind: 'contract', title: 'Handyvertrag', provider: 'Telko', cat: 'phone', cost: '20', interval: 'month', start: '2025-01-01', minTerm: 24, renewal: 'extend', extendM: 12, noticeN: 3, noticeU: 'months', note: '', number: '' },
    // Beginn 1.10.2024, 12 Monate, verlängert sich jährlich → Frist 30.6.2026 schon vorbei, also Ende 30.9.2027, Frist 30.6.2027
    { id: 'k2', kind: 'contract', title: 'Versicherung', provider: 'Vers', cat: 'insurance', cost: '120', interval: 'year', start: '2024-10-01', minTerm: 12, renewal: 'extend', extendM: 12, noticeN: 3, noticeU: 'months', note: '', number: '' },
  ]);
  await tab(page, 'Verträge').click();
  const main = page.locator('#main');
  await expect(main).toContainText('Heute letzter Tag zum Kündigen!');
  await expect(main).toContainText('dann endet er am 31. Dezember 2026');
  await expect(main).toContainText('Kündigen bis 30. Juni 2027');
  // 20 € im Monat + 120 € im Jahr = 30 € pro Monat
  await expect(main).toContainText('30,00 €');
});

test('Geteilter Text wird zur Notiz', async ({ page }) => {
  await page.goto('./?title=Rezept&text=' + encodeURIComponent('Zwei Eier') + '&url=' + encodeURIComponent('https://example.org/r'));
  await expect(page.locator('#nt')).toHaveValue('Rezept');
  await expect(page.locator('#nb')).toContainText('Zwei Eier');
  await expect(page.locator('#nb')).toContainText('https://example.org/r');
  expect(page.url()).not.toContain('Zwei');
  await page.locator('#save').click();
  await expect(page.locator('#main')).toContainText('Rezept');
});

test('Netzsperre blockiert Verbindungen nach außen', async ({ page }) => {
  const outside = [];
  page.on('request', r => { if (!r.url().startsWith('http://127.0.0.1:4173/')) outside.push(r.url()); });
  await page.goto('./');
  await tab(page, 'Einstellungen').click();
  await expect(page.locator('#pnet')).toHaveText('aktiv', { timeout: 5000 });
  const reached = await page.evaluate(() => fetch('https://example.org/').then(() => true, () => false));
  expect(reached).toBe(false);
  expect(outside.filter(u => !u.startsWith('data:') && !u.startsWith('blob:'))).toEqual([]);
});
