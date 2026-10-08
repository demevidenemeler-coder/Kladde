# Tests

Die Tests öffnen die App in einem echten Browser (Chromium, Handy-Größe) und prüfen, ob die wichtigsten Dinge funktionieren. Die App selbst braucht dafür nichts: kein npm, kein Build.

**Auf GitHub:** Die Tests laufen bei jedem Hochladen automatisch (Reiter „Actions“ → „Tests“). Ein rotes ✗ neben dem Commit heißt, dass etwas kaputt ist.

**Auf dem Rechner:**

```
npm install
npx playwright install chromium
npm test
```

## Was geprüft wird

- `app.spec.mjs` – Notizen speichern, Suche, Papierkorb, Zähler- und Vertragsfristen (mit festem Datum 30.9.2026), Teilen an die Kladde, Netzsperre
- `backup.spec.mjs` – Sicherung speichern und laden, Verschlüsselung und falsches Passwort, Zusammenführen, Schadcode in Sicherungsdateien, kaputte Dateien
- `more.spec.mjs` – Träume (Stimmung, Symbole, Statistik, Filter), Checklisten, Zähler neu starten und Verlauf bisheriger Serien, Kasten „Heute und die nächsten Tage“, Kalenderdatei (Erinnerungen, Maskierung, Zeilenumbruch), Einstellungen (Farbmodus, Bereiche, Startbereich, Papierkorb-Frist)
- `offline.spec.mjs` – App ohne Internet, geänderte Dateien kommen auch ohne neue Versionsnummer an
- `files.spec.mjs` – Versionsnummern in `index.html` und `sw.js` gleich, Offline-Liste vollständig, Manifest, Netzsperre-Regeln

## Versionsnummer

Steht an zwei Stellen und muss gleich sein: `const VERSION='15'` in `index.html` und `const VERSION = 'kladde-v15'` in `sw.js`. Ein Test schlägt fehl, wenn sie auseinanderlaufen.

Vergessenes Hochzählen ist nicht mehr schlimm: Die Seite kommt immer frisch aus dem Netz, Icons, Schriften und Manifest werden im Hintergrund aktualisiert. Hochzählen räumt nur alte Offline-Speicher auf.

Kommt eine neue Datei dazu (Icon, Schrift), muss sie in `FILES` in `sw.js` eingetragen werden – sonst meldet `files.spec.mjs` das.
