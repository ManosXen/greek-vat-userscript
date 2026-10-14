// Tests for the pure (DOM-free) core of greek-vat-calc.user.js.
// Usage: node tests/vat_test.mjs     — no dependencies.
import fs from 'node:fs';

const SRC = new URL('../greek-vat-calc.user.js', import.meta.url);
const src = fs.readFileSync(SRC, 'utf8');
const m = src.match(/\/\/ #region pure([\s\S]*?)\/\/ #endregion pure/);
if (!m) { console.error('pure region not found in', SRC.pathname); process.exit(2); }

const { parseAmount, r2, fmtEUR, fmtPlain, blocks } = new Function(
  m[1] + '\nreturn { parseAmount, r2, fmtEUR, fmtPlain, blocks };'
)();

let pass = 0, fail = 0;
const num = (x) => (Number.isNaN(x) ? 'NaN' : x);
function eq(label, got, want, tol = 1e-9) {
  const ok = (typeof want === 'number' && Number.isNaN(want))
    ? Number.isNaN(got)
    : (Math.abs(got - want) <= tol);
  if (ok) { pass++; } else { fail++; console.log(`FAIL ${label}: got ${num(got)} want ${num(want)}`); }
}
function eqs(label, got, want) {
  if (got === want) { pass++; } else { fail++; console.log(`FAIL ${label}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); }
}

// ── parsing (Greek conventions) ─────────────────────────────────────────────
eq('1.234,56',        parseAmount('1.234,56'), 1234.56);
eq('1234,56',         parseAmount('1234,56'), 1234.56);
eq('1234.56',         parseAmount('1234.56'), 1234.56);
eq('1.234 (groups)',  parseAmount('1.234'), 1234);
eq('1.234.567',       parseAmount('1.234.567'), 1234567);
eq('1,5',             parseAmount('1,5'), 1.5);
eq('0,5',             parseAmount('0,5'), 0.5);
eq(',5',              parseAmount(',5'), 0.5);
eq('1234,',           parseAmount('1234,'), 1234);
eq('€ 1.234,56',      parseAmount('€ 1.234,56'), 1234.56);
eq('12 345',          parseAmount('12 345'), 12345);
eq('-1.500,00',       parseAmount('-1.500,00'), -1500);
eq('1,234.56 (US)',   parseAmount('1,234.56'), 1234.56);
eq('1,234,567',       parseAmount('1,234,567'), 1234567);
eq('abc -> NaN',      parseAmount('abc'), NaN);
eq('empty -> NaN',    parseAmount(''), NaN);
eq('24% text',        parseAmount('24%'), 24);

// ── VAT maths ───────────────────────────────────────────────────────────────
const b1000 = blocks(1000, 24);
eq('1000 gross -> net',   b1000.withVat.net, 806.45);
eq('1000 gross -> vat',   b1000.withVat.vat, 193.55);
eq('1000 gross -> total', b1000.withVat.total, 1000);
eq('1000 net -> vat',     b1000.noVat.vat, 240);
eq('1000 net -> total',   b1000.noVat.total, 1240);
eq('124 gross -> net 100', blocks(124, 24).withVat.net, 100);
const b13 = blocks(13, 13);
eq('13 gross @13 -> vat', b13.withVat.vat, 1.5);
eq('13 gross @13 -> net', b13.withVat.net, 11.5);
eq('13 gross sum',        b13.withVat.net + b13.withVat.vat, 13);
eq('100 net @6',          blocks(100, 6).noVat.vat, 6);
eq('rounding 0.01',       blocks(0.01, 24).withVat.vat, 0);
eq('sum consistency 33,33', r2(blocks(33.33, 24).withVat.net + blocks(33.33, 24).withVat.vat), 33.33);

// ── formatting ──────────────────────────────────────────────────────────────
eqs('fmtEUR 1234.56',  fmtEUR(1234.56), '1.234,56 €');
eqs('fmtEUR 1000',     fmtEUR(1000), '1.000,00 €');
eqs('fmtPlain 1234.5', fmtPlain(1234.5), '1234,50');
eqs('fmtPlain 1000',   fmtPlain(1000), '1000,00');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
