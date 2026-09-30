import { test as base, expect } from '@playwright/test';

// Fester „heute“-Tag, damit Zähler und Fristen in jedem Lauf gleich rechnen.
export const TODAY = new Date('2026-09-30T10:00:00+02:00');

// Jeder Test bekommt eine frische App mit festem Datum. Programmfehler auf der Seite lassen den Test scheitern.
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setFixedTime(TODAY);
    await use(page);
    expect(errors, 'JavaScript-Fehler in der App').toEqual([]);
  },
});
export { expect };

// Legt Einträge so ab, wie ältere App-Versionen sie gespeichert haben (localStorage), und lädt die App neu.
// Die App übernimmt sie dabei in ihren Hauptspeicher (IndexedDB).
export async function seed(page, items) {
  await page.goto('./');
  await page.evaluate(list => {
    const obj = {};
    for (const i of list) obj[i.id] = { updatedAt: 1, ...i };
    localStorage.setItem('kladde.v1', JSON.stringify({ savedAt: Date.now(), items: obj }));
  }, items);
  await page.reload();
  await expect(page.locator('.tab').first()).toBeVisible();
}

export const tab = (page, name) => page.getByRole('tab', { name });

export async function newNote(page, title, body) {
  await tab(page, 'Notizen').click();
  await page.locator('#fab').click();
  await page.locator('#nt').fill(title);
  await page.locator('#nb').fill(body);
  await page.locator('#save').click();
  await expect(page.locator('#main')).toContainText(title);
}
