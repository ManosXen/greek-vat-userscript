# ΦΠΑ quick calculator — Greek VAT userscript

A small always-available VAT (ΦΠΑ) calculator that lives in the bottom-right corner
of every page: type an amount and instantly see **Καθαρό / ΦΠΑ / Σύνολο** — for the
Greek rates **24%, 13%, 6%, 4%**.

![screenshot](assets/screenshot.png)

No network calls, no analytics, no page modification — one shadow-DOM panel.

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (Firefox, Chrome, Edge, …).
2. Click **[Install greek-vat-calc.user.js](https://raw.githubusercontent.com/tasosxynos/greek-vat-userscript/main/greek-vat-calc.user.js)**
   — Tampermonkey shows its install page, press *Install*.

Future versions install themselves: `@updateURL` / `@downloadURL` point at this repo.

## What it does

| | |
|---|---|
| Panel | fixed bottom-right on every http(s) page, draggable by its header, collapsible to a pill |
| Input | type any amount; both readings are shown at once, no mode switching |
| Left column | the amount is **με ΦΠΑ** (gross) → `ΦΠΑ`, `Σύνολο`, then the **`Καθαρό`** you are extracting (blue, bottom row) |
| Right column | the amount is **χωρίς ΦΠΑ** (net) → `Καθαρό`, `ΦΠΑ`, then the **`Σύνολο`** you are adding up (blue, bottom row) |
| Highlight | always the result row at the bottom of each column — never the amount you typed |
| Copy | click any of the six values to copy it as `1234,56` (comma decimal, no symbol) |
| Rate | selector in the header: 24% (default) / 13% / 6% / 4% |
| Memory | position, rate and folded state are remembered across pages and sessions |

### Keyboard

| Key | Action |
|---|---|
| `Alt+Q` | focus the amount field (opens the panel if folded) |
| any digit (nothing focused on the page) | jumps straight into the amount field and types it |
| `Esc` | leave the field |

While the caret is in the amount field, keystrokes are stopped from propagating, so
page shortcuts (YouTube, Gmail, …) never fire.

### Number formats

Greek conventions are assumed: `,` is the decimal mark, `.` groups thousands.

| You type | Parsed as |
|---|---|
| `1.234,56` | 1234.56 |
| `1234,56` / `1234.56` | 1234.56 |
| `1.234` | 1234 |
| `€ 1.234,56` | 1234.56 |
| `124` | 124 |

The parsed value is echoed under the field (`= 1.234,56 €`), so a mis-parse is visible
immediately.

## Configuration

Edit the constants at the top of the script:

```js
const RATES = [24, 13, 6, 4];               // κλιμακωτοί συντελεστές ΦΠΑ
const DEFAULT_RATE = 24;
const HOTKEY = { alt: true, code: 'KeyQ' }; // Alt+Q
const QUICK_TYPE = true;                    // type-a-digit-anywhere
```

## Development

The script is a single file, no build step. The maths/parsing core is marked
`// #region pure` … `// #endregion pure` so it can be tested standalone:

```bash
node tests/vat_test.mjs      # 33 assertions, no dependencies
```

## Notes / limits

- Userscripts do not run on `about:`, `file://`, or the built-in PDF viewer; the panel
  is hidden in fullscreen video.
- HTML/CSS/DOM only — nothing is sent anywhere.

## License

MIT — see [LICENSE](LICENSE).
