import { readFile } from 'node:fs/promises';
import { test, expect, seed, tab } from './helpers.mjs';

const dream = (id, date, extra = {}) => ({ id, kind: 'dream', date, title: '', text: 'Traum ' + id, symbols: [], ...extra });

test.describe('Träume', () => {
  test('Traum mit Stimmung, Klartraum und Symbolen anlegen', async ({ page }) => {
    await page.goto('./');
    await tab(page, 'Träume').click();
    await page.locator('#fab').click();
    await page.locator('#dtx').fill('Ich bin über das Meer geflogen');
    await expect(page.locator('#dwc')).toHaveText('6 Wörter');
    await page.locator('#dti').fill('Flug');
    await page.locator('[data-mood="good"]').click();
    await page.locator('#lucid').click();
    await page.locator('#ti').fill('Wasser');
    await page.locator('#ti').press('Enter');
    await page.locator('#ti').fill('#Fliegen');
    await page.locator('#tadd').click();
    await expect(page.locator('#chosen .chip')).toHaveCount(2);
    await page.locator('#save').click();

    await page.reload();
    await tab(page, 'Träume').click();
    await expect(page.locator('#main')).toContainText('Flug');
    await page.locator('#main').getByText('Flug').click();
    await expect(page.locator('[data-mood="good"]')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#lucid')).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#chosen')).toContainText('Wasser');
    await expect(page.locator('#chosen')).toContainText('Fliegen');
    await expect(page.locator('#chosen')).not.toContainText('#');
  });

  test('Statistik und Filter nach häufigen Symbolen', async ({ page }) => {
    await seed(page, [
      dream('d1', '2026-09-28', { title: 'Schwimmbad', symbols: ['Wasser', 'Schule'], lucid: true }),
      dream('d2', '2026-09-10', { title: 'Regen', symbols: ['wasser'] }),
      dream('d3', '2026-08-02', { title: 'Prüfung', symbols: ['Schule'] }),
      dream('d4', '2026-08-01', { title: 'Wald', symbols: ['Baum'], mood: 'bad' }),
    ]);
    await tab(page, 'Träume').click();
    const main = page.locator('#main');
    const nums = main.locator('.stats .nums');
    await expect(nums).toContainText('2diesen Monat');
    await expect(nums).toContainText('4insgesamt');
    await expect(nums).toContainText('1Klarträume');
    // Groß-/Kleinschreibung zählt zusammen, einmalige Symbole erscheinen nicht
    await expect(main.locator('[data-symf]')).toHaveText(['Schule · 2', 'Wasser · 2']);
    // Nach Monat gruppiert, neueste zuerst
    await expect(main.locator('h2.group')).toHaveText(['September 2026', 'August 2026']);

    await main.locator('[data-symf="Wasser"]').click();
    await expect(main).toContainText('Schwimmbad');
    await expect(main).toContainText('Regen');
    await expect(main).not.toContainText('Prüfung');
    await expect(main).not.toContainText('Wald');
  });
});

test.describe('Checklisten', () => {
  test('Punkte anlegen, abhaken und leere Punkte verwerfen', async ({ page }) => {
    await page.goto('./');
    await page.locator('#fab').click();
    await page.locator('#nt').fill('Packliste');
    await page.locator('#cladd').click();
    await page.keyboard.type('Zahnbürste');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Ladekabel');
    await page.keyboard.press('Enter'); // bleibt leer
    await expect(page.locator('#clw input')).toHaveCount(3);
    await page.locator('#clw .cb').first().click();
    await page.locator('#save').click();

    await page.reload();
    await page.locator('#main').getByText('Packliste').click();
    const rows = page.locator('#clw input');
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveValue('Zahnbürste');
    await expect(rows.nth(1)).toHaveValue('Ladekabel');
    await expect(page.locator('#clw .cb').nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#clw .cb').nth(1)).toHaveAttribute('aria-pressed', 'false');
  });

  test('Suche findet Text in Checklisten', async ({ page }) => {
    await seed(page, [{ id: 'n1', kind: 'note', title: 'Einkauf', body: '', tags: [], checklist: [{ id: 'i1', text: 'Haferflocken', done: false }] }]);
    await page.locator('#q').fill('hafer');
    await expect(page.locator('#main')).toContainText('Einkauf');
  });
});

test.describe('Zähler', () => {
  test('Neu starten behält den Rekord', async ({ page }) => {
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'Rauchfrei', date: '2026-09-01', mode: 'since', note: '' }]);
    await tab(page, 'Zähler').click();
    await page.locator('#main').getByText('Rauchfrei').click();
    await page.locator('#restart').click();
    await page.locator('.dlg .yes').click();
    await expect(page.locator('.toast')).toContainText('Rekord: 29 Tage');
    await page.locator('#main').getByText('Rauchfrei').click();
    const streak = page.locator('.streak');
    await expect(streak).toContainText('Aktuell0 Tage');
    await expect(streak).toContainText('Rekord29 Tage');
    await expect(streak).toContainText('Neu gestartet1 Mal');
  });

  test('Neu starten trägt die Serie in „Bisherige Serien“ ein', async ({ page }) => {
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'Rauchfrei', date: '2026-09-01', mode: 'since', note: '' }]);
    await tab(page, 'Zähler').click();
    await page.locator('#main').getByText('Rauchfrei').click();
    await expect(page.locator('.streak .hist')).toHaveCount(0); // noch kein Verlauf
    await page.locator('#restart').click();
    await page.locator('.dlg .yes').click();
    await page.reload();
    await tab(page, 'Zähler').click();
    await page.locator('#main').getByText('Rauchfrei').click();
    const hist = page.locator('.streak .hist');
    await expect(hist.locator('h3')).toHaveText('Bisherige Serien');
    await expect(hist.locator('.stat')).toHaveText(['01.09.2026 – 30.09.2026' + '29 Tage']);
  });

  test('Verlauf: neueste zuerst, Durchschnitt, ältere aufklappbar, kaputte Einträge ignoriert', async ({ page }) => {
    const history = [
      { from: '2025-01-01', to: '2025-01-11', days: 10 },
      { from: '2025-02-01', to: '2025-02-21', days: 20 },
      { from: 'kaputt', to: '2025-03-01', days: 99 },
      { from: '2025-03-01', to: '2025-03-31', days: 30 },
      { from: '2025-04-01', to: '2025-04-02', days: 1 },
      { from: '2025-05-01', to: '2025-05-06', days: 5 },
      { from: '2025-06-01', to: '2025-06-15', days: 14 },
      null,
      { from: '2025-07-01', to: '2025-07-03', days: 2 },
    ];
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'Sport', date: '2026-09-20', mode: 'since', note: '', best: 30, restarts: 7, history }]);
    await tab(page, 'Zähler').click();
    await page.locator('#main').getByText('Sport').click();
    const hist = page.locator('.streak .hist');
    // (10+20+30+1+5+14+2)/7 = 11,7 → 12
    await expect(hist.locator(':scope > .stat').first()).toHaveText('Durchschnitt12 Tage');
    const visible = hist.locator(':scope > .stat');
    await expect(visible).toHaveCount(6); // Durchschnitt + 5 neueste
    await expect(visible.nth(1)).toHaveText('01.07.2025 – 03.07.2025' + '2 Tage');
    await expect(visible.nth(2)).toContainText('14 Tage');
    await expect(visible.nth(5)).toContainText('30 Tage');
    await expect(hist.locator('summary')).toHaveText('2 ältere anzeigen');
    await expect(hist.locator('details .stat').first()).toBeHidden();
    await hist.locator('summary').click();
    await expect(hist.locator('details .stat')).toHaveText(['01.02.2025 – 21.02.2025' + '20 Tage', '01.01.2025 – 11.01.2025' + '10 Tage']);
    await expect(hist).not.toContainText('99');
    await expect(page.locator('.streak')).toContainText('Rekord30 Tage');
  });

  test('Verlauf ist gegen eingeschleustes HTML geschützt', async ({ page }) => {
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'X', date: '2026-09-20', mode: 'since', note: '',
      history: [{ from: '2025-01-01', to: '2025-01-02', days: '<img src=x onerror="window.__boom=1">' }] }]);
    await tab(page, 'Zähler').click();
    await page.locator('#main .item').first().click();
    await expect(page.locator('.streak .hist .stat')).toHaveText('01.01.2025 – 02.01.2025' + '0 Tage');
    expect(await page.evaluate(() => window.__boom)).toBeUndefined();
  });

  test('„Heute und die nächsten Tage“ zeigt anstehende Termine und Fristen', async ({ page }) => {
    await seed(page, [
      { id: 'c1', kind: 'counter', title: 'Urlaub', date: '2026-10-02', mode: 'until', note: '' },
      { id: 'c2', kind: 'counter', title: 'Geburtstag Oma', date: '1950-10-01', mode: 'yearly', note: '' },
      { id: 'c3', kind: 'counter', title: 'Weit weg', date: '2026-12-24', mode: 'until', note: '' },
      { id: 'k1', kind: 'contract', title: 'Fitness', cat: 'fitness', start: '2025-11-01', minTerm: 12, renewal: 'monthly', noticeN: 1, noticeU: 'months', cost: 30, interval: 'month' },
    ]);
    await tab(page, 'Zähler').click();
    const box = page.locator('#top .today');
    await expect(box).toContainText('Urlaub');
    await expect(box).toContainText('in 2 Tagen');
    await expect(box).toContainText('Geburtstag Oma');
    await expect(box).toContainText('morgen');
    await expect(box).toContainText('Fitness');
    await expect(box).toContainText('Kündigungsfrist heute');
    await expect(box).not.toContainText('Weit weg');
  });
});

test.describe('Kalenderdatei', () => {
  async function icsFrom(page, title) {
    await page.locator('#main .item').filter({ hasText: title }).first().click();
    const dl = page.waitForEvent('download');
    await page.locator('#ical').click();
    const d = await dl;
    return { name: d.suggestedFilename(), text: await readFile(await d.path(), 'utf8') };
  }
  // Gefaltete Zeilen wieder zusammensetzen (RFC 5545, Abschnitt 3.1)
  const unfold = t => t.replace(/\r\n[ \t]/g, '');

  test('Termin mit Erinnerungen', async ({ page }) => {
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'Prüfung', date: '2026-10-15', mode: 'until', note: 'Raum 12' }]);
    await tab(page, 'Zähler').click();
    const { name, text } = await icsFrom(page, 'Prüfung');
    expect(name).toBe('kladde-prufung.ics');
    expect(text).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(text).toMatch(/END:VCALENDAR\r\n$/);
    const lines = unfold(text).split('\r\n');
    expect(lines).toContain('DTSTART;VALUE=DATE:20261015');
    expect(lines).toContain('DTEND;VALUE=DATE:20261016');
    expect(lines).toContain('SUMMARY:Prüfung');
    expect(lines).toContain('DESCRIPTION:Raum 12');
    expect(lines.filter(l => l.startsWith('TRIGGER:'))).toEqual(['TRIGGER:-P1DT15H', 'TRIGGER:PT9H']);
  });

  test('Jährlicher Termin wiederholt sich', async ({ page }) => {
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'Hochzeitstag', date: '2015-02-14', mode: 'yearly', note: '' }]);
    await tab(page, 'Zähler').click();
    const lines = unfold((await icsFrom(page, 'Hochzeitstag')).text).split('\r\n');
    expect(lines).toContain('DTSTART;VALUE=DATE:20270214');
    expect(lines).toContain('RRULE:FREQ=YEARLY');
  });

  test('Kündigungsfrist eines Vertrags', async ({ page }) => {
    await seed(page, [{ id: 'k1', kind: 'contract', title: 'Strom', provider: 'Stadtwerke', cat: 'energy', start: '2026-01-01', minTerm: 12, renewal: 'monthly', noticeN: 1, noticeU: 'months', cost: 80, interval: 'month', number: 'A-77' }]);
    await tab(page, 'Verträge').click();
    const lines = unfold((await icsFrom(page, 'Strom')).text).split('\r\n');
    expect(lines).toContain('SUMMARY:Kündigen: Strom');
    expect(lines).toContain('DTSTART;VALUE=DATE:20261130');
    const desc = lines.find(l => l.startsWith('DESCRIPTION:'));
    expect(desc).toContain('31. Dezember 2026');
    expect(desc).toContain('Anbieter: Stadtwerke\\nNummer: A-77');
  });

  test('Sonderzeichen werden nach Kalender-Norm maskiert', async ({ page }) => {
    await seed(page, [{ id: 'c1', kind: 'counter', title: 'Essen; Kino, Bar', date: '2026-10-15', mode: 'until', note: 'Zeile 1\nC:\\Pfad' }]);
    await tab(page, 'Zähler').click();
    const lines = unfold((await icsFrom(page, 'Essen; Kino, Bar')).text).split('\r\n');
    expect(lines).toContain('SUMMARY:Essen\\; Kino\\, Bar');
    expect(lines).toContain('DESCRIPTION:Zeile 1\\nC:\\\\Pfad');
  });

  test('Lange Titel mit Umlauten und Emoji werden sauber umbrochen', async ({ page }) => {
    // 51 Umlaute + Emoji: Das Emoji liegt genau auf der alten Umbruchstelle (60 Zeichen), die Zeile hat über 75 Byte.
    const title = 'ä'.repeat(51) + '🎉 Überraschungsfeier für Jürgen mit Käsekuchen 🎂🎈';
    await seed(page, [{ id: 'c1', kind: 'counter', title, date: '2026-10-15', mode: 'until', note: '' }]);
    await tab(page, 'Zähler').click();
    const { text } = await icsFrom(page, 'Überraschungsfeier');
    expect(text).not.toContain('\uFFFD'); // kein zerbrochenes Zeichen
    for (const l of text.split('\r\n')) expect(Buffer.byteLength(l, 'utf8'), l).toBeLessThanOrEqual(75);
    expect(unfold(text).split('\r\n')).toContain('SUMMARY:' + title);
  });
});

test.describe('Einstellungen', () => {
  test('Dunkler Modus, Listenansicht und Schriftgröße bleiben gespeichert', async ({ page }) => {
    await page.goto('./');
    await tab(page, 'Einstellungen').click();
    await page.locator('[data-set="theme"][data-val="dark"]').click();
    await page.locator('[data-set="view"][data-val="list"]').click();
    await page.locator('[data-set="fontSize"][data-val="xl"]').click();
    await page.reload();
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(html).toHaveAttribute('data-view', 'list');
    expect(await html.evaluate(e => e.style.getPropertyValue('--fs'))).toBe('1.3');
    expect(await page.locator('meta[name=theme-color]').getAttribute('content')).toBe('#0E1424');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(14, 20, 36)');
  });

  test('Bereich ausschalten versteckt ihn, Einträge bleiben', async ({ page }) => {
    await seed(page, [dream('d1', '2026-09-01', { title: 'Bleibt da' })]);
    await tab(page, 'Einstellungen').click();
    await page.locator('[data-sec="dreams"]').click();
    await expect(tab(page, 'Träume')).toHaveCount(0);
    await page.reload();
    await expect(tab(page, 'Träume')).toHaveCount(0);
    await tab(page, 'Einstellungen').click();
    await page.locator('[data-sec="dreams"]').click();
    await tab(page, 'Träume').click();
    await expect(page.locator('#main')).toContainText('Bleibt da');
  });

  test('Der letzte Bereich lässt sich nicht ausschalten', async ({ page }) => {
    await page.goto('./');
    await tab(page, 'Einstellungen').click();
    for (const s of ['notes', 'counters', 'dreams']) await page.locator(`[data-sec="${s}"]`).click();
    await page.locator('[data-sec="contracts"]').click();
    await expect(page.locator('.toast')).toContainText('Mindestens ein Bereich');
    await expect(tab(page, 'Verträge')).toBeVisible();
  });

  test('Startbereich wird beim Öffnen gezeigt', async ({ page }) => {
    await page.goto('./');
    await tab(page, 'Einstellungen').click();
    await page.locator('#startsel').selectOption('contracts');
    await tab(page, 'Träume').click();
    await page.reload();
    await expect(tab(page, 'Verträge')).toHaveAttribute('aria-selected', 'true');
  });

  test('Papierkorb leert sich nach der eingestellten Zeit', async ({ page }) => {
    const day = 864e5, now = Date.parse('2026-09-30T10:00:00+02:00');
    await seed(page, [
      { id: 'n1', kind: 'note', title: 'Frisch gelöscht', body: '', tags: [], checklist: [], deletedAt: now - 3 * day },
      { id: 'n2', kind: 'note', title: 'Uralt gelöscht', body: '', tags: [], checklist: [], deletedAt: now - 31 * day },
    ]);
    await tab(page, 'Einstellungen').click();
    await expect(page.locator('.trash').first()).toContainText('Frisch gelöscht');
    await expect(page.locator('#main')).not.toContainText('Uralt gelöscht');
    await expect(page.locator('.trash').first()).toContainText('in 27 Tagen');
  });
});
