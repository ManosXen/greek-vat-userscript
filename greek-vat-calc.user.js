// ==UserScript==
// @name         QuickVAT
// @name:en      QuickVAT
// @namespace    axynos.local.fpa
// @version      1.4.0
// @description  Αριθμομηχανή ΦΠΑ (Ελλάδα + όλη η ΕΕ) κάτω δεξιά σε κάθε σελίδα: γράψε ένα ποσό και βλέπεις αμέσως Καθαρό / ΦΠΑ / Σύνολο (και με τους δύο τρόπους). Alt+Q εστιάζει το πεδίο, κλικ σε μια τιμή την αντιγράφει.
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
  // Χώρες ΕΕ και συντελεστές: πίνακας EU (πιο κάτω, region: pure)
  const HOTKEY = { alt: true, code: 'KeyQ' }; // Alt+Q → εστίαση στο ποσό
  const QUICK_TYPE = true;                 // γράψε ένα ψηφίο σε σελίδα (χωρίς focus κάπου) → πάει στο πεδίο

  if (document.getElementById('fpa-quick-calc')) return; // no double injection

  // #region pure
  // ─── ΦΠΑ στην ΕΕ: [κωδικός, χώρα, βασικός συντελεστής, [μειωμένοι]] ───────
  // Κατάσταση: Ιαν 2026. Ο βασικός είναι αυτός που ζητάς συνήθως· οι μειωμένοι
  // ισχύουν μόνο για συγκεκριμένα αγαθά/υπηρεσίες (και τα πολύ χαμηλά, π.χ. 2,1%
  // Γαλλία / 3% Λουξεμβούργο / 4% Ισπανία-Ιταλία, είναι «υπέρ-μειωμένοι»).
  // Πηγή: πίνακες ΕΕ (TEDB / taxation-customs.ec.europa.eu).
  const EU = [
    ['AT', 'Αυστρία', 20, [13, 10]],
    ['BE', 'Βέλγιο', 21, [12, 6]],
    ['BG', 'Βουλγαρία', 20, [9]],
    ['FR', 'Γαλλία', 20, [10, 5.5, 2.1]],
    ['DE', 'Γερμανία', 19, [7]],
    ['DK', 'Δανία', 25, []],
    ['GR', 'Ελλάδα', 24, [13, 6, 4]],
    ['EE', 'Εσθονία', 24, [13, 9]],
    ['IE', 'Ιρλανδία', 23, [13.5, 9, 4.8]],
    ['ES', 'Ισπανία', 21, [10, 4]],
    ['IT', 'Ιταλία', 22, [10, 5, 4]],
    ['HR', 'Κροατία', 25, [13, 5]],
    ['CY', 'Κύπρος', 19, [9, 5]],
    ['LV', 'Λετονία', 21, [12, 5]],
    ['LT', 'Λιθουανία', 21, [12, 5]],
    ['LU', 'Λουξεμβούργο', 17, [14, 8, 3]],
    ['MT', 'Μάλτα', 18, [7, 5]],
    ['NL', 'Ολλανδία', 21, [9]],
    ['HU', 'Ουγγαρία', 27, [18, 5]],
    ['PL', 'Πολωνία', 23, [8, 5]],
    ['PT', 'Πορτογαλία', 23, [13, 6]],
    ['RO', 'Ρουμανία', 21, [11]],
    ['SK', 'Σλοβακία', 23, [19, 5]],
    ['SI', 'Σλοβενία', 22, [9.5, 5]],
    ['SE', 'Σουηδία', 25, [12, 6]],
    ['CZ', 'Τσεχία', 21, [12]],
    ['FI', 'Φινλανδία', 25.5, [14, 10]],
  ];
  // σειρά των «συχνών αγορών» στην κορυφή της λίστας (Ελλάδα + μεγάλες αγορές)
  const TOP = ['GR', 'DE', 'IT', 'ES', 'FR', 'NL', 'PL'];

  // ─── e-shops: αναγνώριση από το domain (πρόσθεσε ό,τι άλλο θέλεις) ────────
  // Ό,τι τελειώνει σε '.' σημαίνει «κάθε κατάληξη»: 'amazon.' → amazon.de, amazon.co.uk …
  const SHOPS = [
    // Ελληνικά
    'skroutz.gr', 'bestprice.gr', 'e-shop.gr', 'plaisio.gr', 'kotsovolos.gr',
    'public.gr', 'mediamarkt.gr', 'germanos.gr', 'you.gr', 'shopflix.gr',
    // Διεθνή
    'amazon.', 'ebay.', 'aliexpress.', 'temu.', 'shein.', 'zalando.', 'ikea.',
    'mediamarkt.', 'saturn.de', 'decathlon.', 'alibaba.com', 'banggood.com',
    'walmart.com', 'etsy.com', 'zara.com',
  ];
  const SHOP_RES = SHOPS.map((s) => new RegExp('(^|\\.)' + s.replace(/\./g, '\\.') + (s.endsWith('.') ? '' : '$'), 'i'));
  function isShopHost(host) {
    const h = String(host || '').toLowerCase();
    return SHOP_RES.some((re) => re.test(h));
  }

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
  host.style.visibility = 'hidden';          // εμφανίζεται στο τέλος, αφού μπει στη σωστή θέση
  const sh = host.attachShadow({ mode: 'open' });
  sh.innerHTML = `
  <style>
    :host { all: initial; }
    .wrap, .wrap * { box-sizing: border-box; margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; }
    .wrap {
      position: fixed; right: 12px; bottom: 12px; z-index: 2147483646;   /* κάτω από το QuickLimits, πάνω από την υπόλοιπη σελίδα */
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
    #cc { max-width: 118px; }
    #rate { flex: 0 0 auto; }
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
    .parsed { color: #8b93a1; font-size: 11px; padding: 3px 2px 6px; min-height: 15px; font-variant-numeric: tabular-nums; }
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
        <select id="cc" title="χώρα"></select>
        <select id="rate" title="συντελεστής ΦΠΑ"></select>
        <span class="grow"></span>
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
            <div class="row" data-k="wvat"><span class="lab">ΦΠΑ</span><span class="val" id="wVat">—</span></div>
            <div class="row" data-k="wtot"><span class="lab">Σύνολο</span><span class="val" id="wTot">—</span></div>
            <div class="row" data-k="wnet"><span class="lab">Καθαρό</span><span class="val" id="wNet">—</span></div>
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
  const amt = $('amt'), ccSel = $('cc'), rateSel = $('rate'), parsedEl = $('parsed');
  // η μπλε γραμμή = το ζητούμενο ποσό κάθε στήλης:
  //  αριστερά (το ποσό είναι με ΦΠΑ)  → Καθαρό (αφαιρείται ο ΦΠΑ)
  //  δεξιά    (το ποσό είναι χωρίς ΦΠΑ) → Σύνολο (προστίθεται ο ΦΠΑ)
  const HIGHLIGHT = new Set(['wnet', 'ntot']);
  const CELLS = [
    ['wVat', 'wvat'], ['wTot', 'wtot'], ['wNet', 'wnet'],
    ['nNet', 'nnet'], ['nVat', 'nvat'], ['nTot', 'ntot'],
  ];
  let current = {};

  const ratesOf = (cc) => {
    const c = EU.find((x) => x[0] === cc) || EU.find((x) => x[0] === 'GR');
    return [c[2], ...c[3]];
  };
  const nameOf = (cc) => (EU.find((c) => c[0] === cc) || [null, 'Ελλάδα'])[1];
  const currentRate = () => {
    const v = Number(rateSel.value);
    return Number.isFinite(v) && v > 0 ? v : ratesOf(ccSel.value)[0];
  };
  const rateLabel = (r) => String(r).replace('.', ',') + '%';

  function makeOption(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  function buildCountrySelect() {
    const inTop = new Set(TOP);
    const gTop = document.createElement('optgroup');
    gTop.label = 'Συχνές αγορές';
    TOP.forEach((cc) => { if (EU.some((c) => c[0] === cc)) gTop.appendChild(makeOption(cc, nameOf(cc))); });
    const gRest = document.createElement('optgroup');
    gRest.label = 'Λοιπές χώρες ΕΕ';
    EU.forEach((c) => { if (!inTop.has(c[0])) gRest.appendChild(makeOption(c[0], c[1])); });
    ccSel.append(gTop, gRest);
  }

  function buildRateSelect(keepRate) {
    const rates = ratesOf(ccSel.value);
    const prev = keepRate ? Number(rateSel.value) : NaN;
    rateSel.textContent = '';
    rates.forEach((r) => rateSel.appendChild(makeOption(String(r), rateLabel(r))));
    rateSel.value = rates.includes(prev) ? String(prev) : String(rates[0]);
  }

  function render() {
    const raw = amt.value;
    const v = parseAmount(raw);
    const ok = Number.isFinite(v);
    const hasInput = raw.trim() !== '';
    parsedEl.textContent = ok ? '= ' + fmtEUR(v) : (hasInput ? 'δεν αναγνωρίζεται' : 'Alt+Q');
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
    const b = blocks(v, currentRate());
    current = {
      wnet: b.withVat.net, wvat: b.withVat.vat, wtot: b.withVat.total,
      nnet: b.noVat.net, nvat: b.noVat.vat, ntot: b.noVat.total,
    };
    for (const [id, key] of CELLS) {
      const el = $(id);
      el.textContent = fmtEUR(current[key]);
      el.parentElement.classList.toggle('hit', HIGHLIGHT.has(key));
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
    customPos = true;                      // θέση διαλεγμένη με το χέρι → μένει εκεί
  }
  function savePos() {
    sset('x', parseFloat(wrap.style.left) || 0);
    sset('y', parseFloat(wrap.style.top) || 0);
  }
  // Δύο περιπτώσεις:
  //  • προεπιλεγμένη θέση (κολλημένο κάτω δεξιά): η μπάρα πάει στην άκρη όταν συμπτύσσεται
  //    και το πλαίσιο ανοίγει προς τα πάνω — όπως «πρωτόγονα» δούλευε.
  //  • θέση που διάλεξες με το χέρι: η πάνω-αριστερή γωνία μένει σταθερή, δεν σου φεύγει.
  function setOpen(open, save) {
    if (open !== wrap.classList.contains('open')) {
      wrap.classList.toggle('open', open);
      if (customPos) {
        const r = wrap.getBoundingClientRect();
        wrap.style.left = r.left + 'px';
        wrap.style.top = r.top + 'px';
        const n = wrap.getBoundingClientRect();          // να μη βγει έξω από την οθόνη
        if (n.bottom > window.innerHeight - 4) wrap.style.top = Math.max(0, window.innerHeight - n.height - 12) + 'px';
        if (n.right > window.innerWidth - 4) wrap.style.left = Math.max(0, window.innerWidth - n.width - 12) + 'px';
      }
      if (save !== false) sset('open', open);
    }
    $('fold').textContent = open ? '–' : '+';
  }

  const isShop = () => isShopHost(location.hostname);
  let autoFolded = false;                    // η τελευταία σύμπτυξη ήταν αυτόματη (όχι επιλογή σου)
  let customPos = sget('x', null) != null && sget('y', null) != null;   // το έχεις μετακινήσει εσύ

  function openAndFocus() {
    autoFolded = false;
    setOpen(true);
    amt.focus();
  }

  // Στις μη-e-shop σελίδες το πλαίσιο μένει συμπτυγμένο — και ξανά, όποτε αλλάζεις καρτέλα.
  function applyContext() {
    if (sh.activeElement === amt) return;    // γράφεις στο πεδίο — μην σου το κλείσει
    if (isShop()) {
      if (autoFolded) { autoFolded = false; setOpen(true, false); }
    } else {
      if (wrap.classList.contains('open')) setOpen(false, false);
      autoFolded = true;
    }
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
    else { autoFolded = false; setOpen(!wrap.classList.contains('open')); }  // απλό κλικ στην μπάρα = άνοιξε/κλείσε
  });
  // διπλό κλικ στην μπάρα → πίσω στην προεπιλεγμένη θέση (κάτω δεξιά)
  $('hdr').addEventListener('dblclick', (e) => {
    if (e.target.closest('select,button')) return;
    customPos = false;
    sset('x', null);
    sset('y', null);
    wrap.style.left = '';
    wrap.style.top = '';
    wrap.style.right = '';
    wrap.style.bottom = '';
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
  ccSel.addEventListener('change', () => {
    sset('cc', ccSel.value);
    buildRateSelect(false);                      // νέα χώρα → ο βασικός της συντελεστής
    sset('rate', Number(rateSel.value));
    render();
  });
  rateSel.addEventListener('change', () => { sset('rate', Number(rateSel.value)); render(); });
  $('fold').addEventListener('click', () => { autoFolded = false; setOpen(!wrap.classList.contains('open')); });
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
      e.preventDefault();
      if (!wrap.classList.contains('open')) { autoFolded = false; setOpen(true, false); }  // ανοίγει και γράφει
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

  const savedRate = Number(sget('rate', NaN));
  buildCountrySelect();
  const savedCc = String(sget('cc', 'GR'));
  ccSel.value = EU.some((c) => c[0] === savedCc) ? savedCc : 'GR';
  buildRateSelect(true);
  if (ratesOf(ccSel.value).includes(savedRate)) rateSel.value = String(savedRate);
  render();                                          // γέμισε το πλαίσιο πριν μετρηθεί η θέση
  // Ξεκινάει συμπτυγμένο παντού, ανοιχτό μόνο σε e-shop (Skroutz, bestprice, Amazon…).
  if (isShop()) { autoFolded = false; setOpen(sget('open', true) !== false, false); }
  else { setOpen(false, false); autoFolded = true; }
  if (sget('x', null) != null && sget('y', null) != null) place(sget('x', 0), sget('y', 0));
  host.style.visibility = '';                       // φαίνεται μόνο αφού τακτοποιηθεί η θέση
  // αλλαγή καρτέλας / επιστροφή στο παράθυρο → ξανά συμπτυγμένο στις μη-e-shop σελίδες
  document.addEventListener('visibilitychange', () => { if (!document.hidden) applyContext(); });
  window.addEventListener('focus', applyContext);
})();
