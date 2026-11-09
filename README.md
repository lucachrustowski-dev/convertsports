# ConvertSports

Rechne deine Leistung von einer Sportart in eine andere um. Eine Seite, kein Account.

Disziplinen zum Start: **Bankdrücken** (kg oder lbs), **100 m Kraul** und **100 m Brust** (Langbahn), **100 m Sprint**.
Vorher gibst du Alter, Körpergewicht und Geschlecht an.

## Starten

Reines HTML, CSS und JavaScript, kein Build-Schritt:

```bash
npm start   # öffnet einen lokalen Server auf http://localhost:4173
npm test    # testet das Umrechnungsmodell
```

Läuft so auch direkt auf GitHub Pages, Vercel oder Netlify.

## So wird gerechnet (`model.js`)

Jede Leistung wird in eine gemeinsame Punktzahl übersetzt und zurück in die anderen Disziplinen:

- **Bankdrücken** zählt relativ zum Körpergewicht (DOTS-Formel, getrennt nach Geschlecht).
- **Zeiten** zählen gegen eine Weltklasse-Referenz pro Geschlecht, Punkte = (Referenz / Zeit)^k.
- **Alter** wird pro Disziplin gewertet (Leistungshoch, danach ein jährlicher Abschlag).

Geeicht auf: Mann, 25 Jahre, 80 kg → 120 kg Bankdrücken = 56,50 Kraul = 1:12,00 Brust = 11,20 s Sprint (554 Punkte).
Den Anker änderst du in `ANCHOR` in `model.js`, alles andere rechnet sich daraus. Eine Schätzung zum Vergleichen, kein Wettkampfstandard.

## Design

Gebaut mit dem [Hallmark](https://github.com/nutlope/hallmark)-Design-Skill, Theme „Sport“ (`tokens.css`, `base.css`).
Piktogramme: [IconOven](https://iconoven.com/icons) (MIT); das Brust-Piktogramm ist im selben Stil ergänzt.
