// Prüft die Programmdateien selbst, ohne Browser: passen Versionsnummern und Offline-Liste zusammen?
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const read = f => readFileSync(new URL(f, root), 'utf8');
const html = read('index.html');
const sw = read('sw.js');

const swVersion = sw.match(/const VERSION = '([^']+)'/)?.[1];
const appVersion = html.match(/const VERSION='([^']+)'/)?.[1];
const FILES = new Function('return ' + sw.match(/const FILES = (\[[\s\S]*?\]);/)[1])();
const inFiles = f => FILES.includes('./' + f);

test('Versionsnummer in index.html und sw.js ist gleich', () => {
  expect(swVersion, 'VERSION in sw.js').toBeTruthy();
  expect(appVersion, 'VERSION in index.html').toBeTruthy();
  expect(swVersion, 'sw.js muss "kladde-v" + VERSION aus index.html haben').toBe('kladde-v' + appVersion);
});

test('Jede Datei der Offline-Liste existiert', () => {
  for (const f of FILES) {
    if (f === './') continue;
    expect(existsSync(new URL(f, root)), `${f} aus sw.js fehlt`).toBe(true);
  }
});

test('Alles, was die App lädt, steht in der Offline-Liste', () => {
  const refs = new Set();
  for (const m of html.matchAll(/(?:href|src)="([^"#:?]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/url\(([^)'"]+)\)/g)) refs.add(m[1]);
  for (const icon of JSON.parse(read('manifest.webmanifest')).icons) refs.add(icon.src);
  for (const dir of ['icons', 'fonts']) {
    for (const f of readdirSync(new URL(dir + '/', root))) if (/\.(png|woff2)$/.test(f)) refs.add(`${dir}/${f}`);
  }
  refs.delete('sw.js'); // der Service Worker selbst gehört nicht in seinen Speicher
  expect(refs.size).toBeGreaterThan(5);
  for (const r of refs) expect(inFiles(r), `${r} fehlt in FILES in sw.js – offline würde es fehlen`).toBe(true);
});

test('Manifest ist gültig und passt zur App', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  expect(m.start_url).toBe('./');
  expect(m.icons.some(i => i.purpose === 'maskable')).toBe(true);
  expect(Object.keys(m.share_target.params).sort()).toEqual(['text', 'title', 'url']);
});

test('Netzsperre (Content-Security-Policy) ist unverändert streng', () => {
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1] || '';
  for (const rule of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "font-src 'self'", "script-src 'self' 'unsafe-inline'"]) {
    expect(csp, `Regel fehlt: ${rule}`).toContain(rule);
  }
  expect(csp).not.toMatch(/https?:/);
});
