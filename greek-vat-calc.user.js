// ==UserScript==
// @name         ΦΠΑ quick calculator (Greek VAT 24/13/6/4%)
// @name:en      Greek VAT quick calculator
// @namespace    axynos.local.fpa
// @version      1.0.0
// @description  Μικρή αριθμομηχανή ΦΠΑ κάτω δεξιά σε κάθε σελίδα: γράψε ένα ποσό και βλέπεις αμέσως Καθαρό / ΦΠΑ / Σύνολο (και με τους δύο τρόπους). Alt+Q εστιάζει το πεδίο, κλικ σε μια τιμή την αντιγράφει.
// @author       Anastasios Xynos (tasosxynos)
// @license      MIT
// @homepageURL  https://github.com/tasosxynos/greek-vat-userscript
// @supportURL   https://github.com/tasosxynos/greek-vat-userscript/issues
// @downloadURL  https://raw.githubusercontent.com/tasosxynos/greek-vat-userscript/main/greek-vat-calc.user.js
// @updateURL    https://raw.githubusercontent.com/tasosxynos/greek-vat-userscript/main/greek-vat-calc.user.js
// @match        *://*/*
// @run-at       document-idle
// @noframes
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  // ─── ρυθμίσεις (πείραξέ τες ελεύθερα) ──────────────────────────────────────
  const RATES = [24, 13, 6, 4];            // διαθέσιμοι συντελεστές ΦΠΑ
  const DEFAULT_RATE = 24;                 // προεπιλογή 24%
  const HOTKEY = { alt: true, code: 'KeyQ' }; // Alt+Q → εστίαση στο ποσό
  const QUICK_TYPE = true;                 // γράψε ένα ψηφίο σε σελίδα (χωρίς focus κάπου) → πάει στο πεδίο

  if (document.getElementById('fpa-quick-calc')) return; // no double injection

  // #region pure
  // ─── αριθμοί: ελληνική σύμβαση — ',' δεκαδικό, '.' χιλιάδες ──────────────
  function parseAmount(raw) {
    if (raw == null) return NaN;
    let s = String(raw).trim().replace(/[€\s\u00A0]/g, '').replace(/[^0-9.,-]/g, '');
    if (!s) return NaN;
    const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc > -1 && ld > -1) {              // και τα δύο → δεκαδικό είναι το δεξιότερο
      const decIsComma = lc > ld;
      s = s.split(decIsComma ? '.' : ',').join('');
      if (decIsComma) s = s.replace(',', '.');
    } else if (lc > -1) {                  // μόνο κόμματα
      const p = s.split(',');
      s = p.length > 2 ? p.join('') : p[0] + '.' + p[1];
    } else if (ld > -1) {                  // μόνο τελείες: 1.234 / 1.234.567 = ομάδες χιλιάδων
      if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.split('.').join('');
    }
    const v = parseFloat(s);
    return Number.isFinite(v) ? v : NaN;
  }

  const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
  const fmtEUR = (x) => x.toLocaleString('el-GR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const fmtPlain = (x) => x.toFixed(2).replace('.', ',');   // για επικόλληση: 1000,00

  function blocks(amount, ratePct) {
    const a = r2(amount), r = ratePct / 100;
    const vatOf = r2(a - a / (1 + r));       // το ποσό είναι ΜΕ ΦΠΑ
    const netOf = r2(a - vatOf);
    const vatAdd = r2(a * r);                // το ποσό είναι ΧΩΡΙΣ ΦΠΑ
    const grossOf = r2(a + vatAdd);
    return {
      withVat: { net: netOf, vat: vatOf, total: a },
      noVat:   { net: a,     vat: vatAdd, total: grossOf },
    };
  }
  // #endregion pure

  // ─── αποθήκευση ρυθμίσεων (θέση / συντελεστής / ανοιχτό-κλειστό) ──────────
  function sget(k, d) {
    try {
      if (typeof GM_getValue === 'function') return GM_getValue(k, d);
      const v = localStorage.getItem('fpa.' + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) { return d; }
  }
  function sset(k, v) {
    try {
      if (typeof GM_setValue === 'function') GM_setValue(k, v);
      else localStorage.setItem('fpa.' + k, JSON.stringify(v));
    } catch (e) { /* ignore */ }
  }

  // ─── UI ───────────────────────────────────────────────────────────────────
  const host = document.createElement('div');
  host.id = 'fpa-quick-calc';
  const sh = host.attachShadow({ mode: 'open' });
  sh.innerHTML = `
  <style>
    :host { all: initial; }
    .wrap, .wrap * { box-sizing: border-box; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
    .wrap {
      position: fixed; right: 12px; bottom: 12px; z-index: 2147483647;
      font-size: 12px; line-height: 1.4; color: #e6e9ee; text-align: left; direction: ltr;
    }
    .panel {
      width: 320px; background: rgba(17,19,24,.95);
      border: 1px solid rgba(255,255,255,.16); border-radius: 10px;
      box-shadow: 0 8px 28px rgba(0,0,0,.45); overflow: hidden;
    }
    header { display: flex; align-items: center; gap: 6px; padding: 5px 7px;
             background: rgba(255,255,255,.05); user-select: none; cursor: default; }
    header .dot { width: 8px; height: 8px; border-radius: 50%; background: #4da3ff; flex: 0 0 auto; }
    header .title { font-weight: 600; letter-spacing: .3px; }
    select { background: rgba(255,255,255,.08); color: #e6e9ee; font-size: 11px; padding: 1px 2px;
             border: 1px solid rgba(255,255,255,.18); border-radius: 5px; }
    header .grow { flex: 1 1 auto; }
    header .hint { color: #8b93a1; font-size: 10px; }
    header button { background: transparent; border: 0; color: #8b93a1; font-size: 14px; line-height: 1;
                    padding: 2px 6px; border-radius: 5px; cursor: pointer; }
    header button:hover { background: rgba(255,255,255,.12); color: #fff; }
    .body { display: none; padding: 7px; }
    .wrap.open .body { display: block; }
    .inrow { display: flex; gap: 5px; }
    input {
      flex: 1 1 auto; width: 100%; background: rgba(255,255,255,.08); color: #fff;
      border: 1px solid rgba(255,255,255,.2); border-radius: 6px; padding: 5px 7px;
      font-size: 15px; font-variant-numeric: tabular-nums; text-align: right; outline: none;
    }
    input:focus { border-color: #4da3ff; background: rgba(77,163,255,.12); }
    input::placeholder { color: #6f7783; font-size: 12px; }
    #clr { flex: 0 0 auto; width: 26px; background: rgba(255,255,255,.08); color: #b9c1cc;
           border: 1px solid rgba(255,255,255,.2); border-radius: 6px; font-size: 14px; cursor: pointer; }
    #clr:hover { color: #fff; background: rgba(255,255,255,.16); }
    .parsed { color: #8b93a1; font-size: 11px; padding: 3px 2px 6px; font-variant-numeric: tabular-nums; }
    .parsed.bad { color: #ff9b9b; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .col { border: 1px solid rgba(255,255,255,.12); border-radius: 8px; padding: 4px 5px 5px; }
    .col h4 { font-size: 10px; font-weight: 600; color: #8b93a1; text-transform: uppercase;
              letter-spacing: .5px; margin-bottom: 3px; }
    .row { display: flex; align-items: baseline; justify-content: space-between; gap: 3px;
           padding: 2px 4px; border-radius: 5px; cursor: pointer; }
    .row:hover { background: rgba(77,163,255,.16); }
    .lab { color: #98a1ad; }
    .val { font-variant-numeric: tabular-nums; white-space: nowrap; }
    .row.hit .val { color: #4da3ff; font-weight: 600; }
    .toast { height: 14px; margin-top: 5px; font-size: 11px; color: #7ee08a; opacity: 0; transition: opacity .15s; }
    .toast.show { opacity: 1; }
  </style>
  <div class="wrap open">
    <div class="panel">
      <header id="hdr">
        <span class="dot"></span>
        <span class="title">ΦΠΑ</span>
        <select id="rate" title="συντελεστής ΦΠΑ">
          ${RATES.map((r) => `<option value="${r}"${r === DEFAULT_RATE ? ' selected' : ''}>${r}%</option>`).join('')}
        </select>
        <span class="grow"></span>
        <span class="hint">Alt+Q</span>
        <button id="fold" title="σύμπτυξη">–</button>
      </header>
      <div class="body">
        <div class="inrow">
          <input id="amt" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="ποσό…">
          <button id="clr" title="καθαρισμός">×</button>
        </div>
        <div class="parsed" id="parsed"></div>
        <div class="grid">
          <section class="col">
            <h4>με ΦΠΑ</h4>
            <div class="row" data-k="wnet"><span class="lab">Καθαρό</span><span class="val" id="wNet">—</span></div>
            <div class="row" data-k="wvat"><span class="lab">ΦΠΑ</span><span class="val" id="wVat">—</span></div>
            <div class="row" data-k="wtot"><span class="lab">Σύνολο</span><span class="val" id="wTot">—</span></div>
          </section>
          <section class="col">
            <h4>χωρίς ΦΠΑ</h4>
            <div class="row" data-k="nnet"><span class="lab">Καθαρό</span><span class="val" id="nNet">—</span></div>
            <div class="row" data-k="nvat"><span class="lab">ΦΠΑ</span><span class="val" id="nVat">—</span></div>
            <div class="row" data-k="ntot"><span class="lab">Σύνολο</span><span class="val" id="nTot">—</span></div>
          </section>
        </div>
        <div class="toast" id="toast"></div>
      </div>
    </div>
  </div>`;

  const $ = (id) => sh.getElementById(id);
  const wrap = sh.querySelector('.wrap');
  const amt = $('amt'), rateSel = $('rate'), parsedEl = $('parsed');
  const eq = (a, b) => Math.abs(r2(a) - r2(b)) < 0.005;
  const CELLS = [
    ['wNet', 'wnet'], ['wVat', 'wvat'], ['wTot', 'wtot'],
    ['nNet', 'nnet'], ['nVat', 'nvat'], ['nTot', 'ntot'],
  ];
  let current = {};

  function render() {
    const raw = amt.value;
    const v = parseAmount(raw);
    const ok = Number.isFinite(v);
    const hasInput = raw.trim() !== '';
    parsedEl.textContent = ok ? '= ' + fmtEUR(v) : (hasInput ? 'δεν αναγνωρίζεται' : '');
    parsedEl.classList.toggle('bad', hasInput && !ok);
    if (!ok) {
      current = {};
      for (const [id] of CELLS) {
        const el = $(id);
        el.textContent = '—';
        el.parentElement.classList.remove('hit');
      }
      return;
    }
    const b = blocks(v, Number(rateSel.value) || DEFAULT_RATE);
    current = {
      wnet: b.withVat.net, wvat: b.withVat.vat, wtot: b.withVat.total,
      nnet: b.noVat.net, nvat: b.noVat.vat, ntot: b.noVat.total,
    };
    for (const [id, key] of CELLS) {
      const el = $(id);
      el.textContent = fmtEUR(current[key]);
      el.parentElement.classList.toggle('hit', eq(current[key], v));   // η τιμή που έγραψες
    }
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1300);
  }

  async function copyText(txt, label) {
    try {
      await navigator.clipboard.writeText(txt);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_) { /* ignore */ }
      ta.remove();
    }
    toast('Αντιγράφηκε: ' + label + '  (' + txt + ')');
  }

  // ─── θέση / σύμπτυξη ──────────────────────────────────────────────────────
  function place(x, y) {
    x = Math.min(Math.max(0, x), Math.max(0, window.innerWidth - 40));
    y = Math.min(Math.max(0, y), Math.max(0, window.innerHeight - 24));
    wrap.style.left = x + 'px';
    wrap.style.top = y + 'px';
    wrap.style.right = 'auto';
    wrap.style.bottom = 'auto';
  }
  function savePos() {
    sset('x', parseFloat(wrap.style.left) || 0);
    sset('y', parseFloat(wrap.style.top) || 0);
  }
  function setOpen(open, save) {
    wrap.classList.toggle('open', open);
    $('fold').textContent = open ? '–' : '+';
    if (save !== false) sset('open', open);
  }
  function openAndFocus() {
    setOpen(true);
    amt.focus();
  }

  let drag = null;
  $('hdr').addEventListener('mousedown', (e) => {
    if (e.target.closest('select,button')) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, rect: wrap.getBoundingClientRect() };
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    place(drag.rect.left + dx, drag.rect.top + dy);
  });
  window.addEventListener('mouseup', () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    if (moved) savePos();
    else setOpen(!wrap.classList.contains('open'));   // απλό κλικ στην μπάρα = άνοιξε/κλείσε
  });
  window.addEventListener('resize', () => {
    if (wrap.style.left) place(parseFloat(wrap.style.left), parseFloat(wrap.style.top));
  });

  // ─── συμπεριφορά πεδίου ───────────────────────────────────────────────────
  amt.addEventListener('input', render);
  amt.addEventListener('focus', () => amt.select());
  ['keydown', 'keyup', 'keypress', 'input'].forEach((ev) =>
    amt.addEventListener(ev, (e) => {
      e.stopPropagation();                       // να μην τα βλέπει η σελίδα (shortcuts π.χ. YouTube)
      if (ev === 'keydown' && e.key === 'Escape') amt.blur();
    })
  );
  amt.addEventListener('blur', () => { if (!wrap.matches(':hover')) amt.setSelectionRange(0, 0); });
  $('clr').addEventListener('click', () => { amt.value = ''; render(); amt.focus(); });
  rateSel.addEventListener('change', () => { sset('rate', Number(rateSel.value)); render(); });
  $('fold').addEventListener('click', () => setOpen(!wrap.classList.contains('open')));
  sh.querySelectorAll('.row').forEach((row) =>
    row.addEventListener('click', () => {
      const k = row.dataset.k;
      if (!(k in current)) return;
      copyText(fmtPlain(current[k]), fmtEUR(current[k]));
    })
  );

  // Alt+Q → εστίαση στο ποσό
  document.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === HOTKEY.code) {
      e.preventDefault();
      e.stopPropagation();
      openAndFocus();
    }
  }, true);

  // γρήγορη πληκτρολόγηση: ψηφίο πάνω στη σελίδα → πάει στο πεδίο
  if (QUICK_TYPE) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey || e.defaultPrevented) return;
      if (e.target !== document.body) return;               // κάτι άλλο έχει focus
      if (!/^[0-9]$/.test(e.key) && e.key !== ',' && e.key !== '.') return;
      if (!wrap.classList.contains('open')) return;
      e.preventDefault();
      amt.focus();
      amt.value += e.key;
      render();
    }, true);
  }

  // ─── τοποθέτηση ───────────────────────────────────────────────────────────
  document.documentElement.appendChild(host);
  document.addEventListener('fullscreenchange', () => {
    host.style.display = document.fullscreenElement ? 'none' : '';
  });

  const savedRate = Number(sget('rate', DEFAULT_RATE));
  if (RATES.includes(savedRate)) rateSel.value = String(savedRate);
  setOpen(sget('open', true) !== false, false);
  if (sget('x', null) != null && sget('y', null) != null) place(sget('x', 0), sget('y', 0));
  render();
})();
