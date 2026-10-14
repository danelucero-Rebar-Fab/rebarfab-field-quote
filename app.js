/* Rebar-Fab Field Quote - app UI */
'use strict';
const CREDIT = 'Designed by Joe Dane Lucero P.E.';
const C = RFCalc, $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toLocaleDateString('en-CA');
const BARS = [3,4,5,6,7,8,9,10,11], BARS_ALL = [3,4,5,6,7,8,9,10,11,14,18];
const COMPANY = { name:'Rebar-Fab', addr1:'207 Sentry Drive', addr2:'Mansfield, TX 76063', main:'(817) 908-0069', direct:'817.798.2483', email:'d.lucero@rebar-fab.com', contact:'Joe Lucero' };

/* ---------- storage (IndexedDB) ---------- */
let dbp;
function db() { return dbp ||= new Promise((res, rej) => { const r = indexedDB.open('rebarfab-field-quote', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('quotes', {keyPath:'id'}); r.result.createObjectStore('photos', {keyPath:'id'}); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function tx(store, mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store);
  const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); }
const put = (st, v) => tx(st, 'readwrite', s => s.put(v)), del = (st, k) => tx(st, 'readwrite', s => s.delete(k));
const getAll = st => tx(st, 'readonly', s => s.getAll()), get1 = (st, k) => tx(st, 'readonly', s => s.get(k));

/* ---------- state ---------- */
const S = Object.assign({}, C.DEFAULTS, JSON.parse(localStorage.getItem('rf_settings') || '{}'));
let ACC = [];
const newQuote = () => ({ id:uid(), customer:'', project:'', date:today(), rep:'Joe Lucero', notes:'', lines:[], acc:[],
  location:'', phone:'', email:'', no:'RF-' + new Date().toISOString().slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(), manual:false, mlines:[], shop:{mode:'auto', rate:'', flat:''}, trucking:{mode:'auto', manualBy:'total', total:'', loads:'', perLoad:S.truckPerLoad}, ov:{}, showCredit:false, photos:[], updated:Date.now() });
let Q = JSON.parse(localStorage.getItem('rf_current') || 'null') || newQuote();
let saveT; function touch() { Q.ov ||= {}; Q.mlines ||= []; Q.shop ||= {mode:'auto', rate:'', flat:''}; if (!Q.no) Q.no = 'RF-' + Q.id.slice(-6).toUpperCase(); Q.updated = Date.now(); localStorage.setItem('rf_current', JSON.stringify(Q)); clearTimeout(saveT); saveT = setTimeout(() => put('quotes', Q), 400);
  $('#qname').textContent = Q.project || Q.customer || 'Rebar-Fab Field Quote'; }

/* ---------- element schemas ---------- */
const BAR = 'bar', HK = 'sel:0,1,2';
const EL = {
  slab:{name:'Slab / mat', f:[['L','Length (ft)'],['W','Width (ft)'],['bar','Bar size',BAR],['sX','Spacing, bars across L (in)'],['sY','Spacing, bars across W (in)'],['layers','Layers','sel:1=Bottom only,2=Top & bottom'],['cover','Cover (in)'],['hooks','Hooks per bar',HK]], d:{L:40,W:30,bar:4,sX:12,sY:12,layers:1,cover:3,hooks:0}},
  footing:{name:'Continuous footing / grade beam', f:[['LF','Length (LF)'],['width','Width (in)'],['depth','Depth (in)'],['cover','Cover (in)'],['bar','Long. bar',BAR],['nLong','# long. bars'],['hooks','Hooks/long. bar',HK],['tieBar','Stirrup/tie bar',BAR],['sTie','Stirrup spacing (in)']], d:{LF:100,width:24,depth:24,cover:3,bar:5,nLong:4,hooks:0,tieBar:3,sTie:12}},
  pad:{name:'Spread footing / pad', f:[['count','# pads'],['L','Length (ft)'],['W','Width (ft)'],['bar','Bar size',BAR],['sp','Spacing each way (in)'],['cover','Cover (in)'],['hooks','Hooks per bar',HK]], d:{count:4,L:6,W:6,bar:5,sp:12,cover:3,hooks:0}},
  pier:{name:'Pier / drilled shaft', f:[['count','# piers'],['depth','Depth (ft)'],['dia','Diameter (in)'],['cover','Cover (in)'],['bar','Vertical bar',BAR],['nVert','# verticals'],['proj','Projection above top (ft)'],['tieType','Ties or spiral','sel:ties=Hoop ties,spiral=Spiral'],['tieBar','Tie/spiral bar',BAR],['pitch','Tie spacing / spiral pitch (in)']], d:{count:4,depth:20,dia:24,cover:3,bar:6,nVert:6,proj:0,tieType:'ties',tieBar:3,pitch:12}},
  wall:{name:'Wall', f:[['L','Length (ft)'],['H','Height (ft)'],['cover','Cover (in)'],['vBar','Vertical bar',BAR],['sV','Vertical spacing (in)'],['hBar','Horizontal bar',BAR],['sH','Horizontal spacing (in)'],['curtains','Curtains','sel:1=One,2=Two'],['dowel','Dowel/lap added to verticals (ft)']], d:{L:50,H:10,cover:2,vBar:5,sV:12,hBar:4,sH:12,curtains:1,dowel:0}},
  ductbank:{name:'Ductbank', f:[['LF','Length (LF)'],['width','Width (in)'],['depth','Height (in)'],['cover','Cover (in)'],['bar','Long. bar',BAR],['nLong','# long. bars'],['tieBar','Tie bar',BAR],['sTie','Tie spacing (in)']], d:{LF:200,width:30,depth:24,cover:3,bar:5,nLong:6,tieBar:4,sTie:24}},
  bundle:{name:'Bundles (stock bars)', f:[['bar','Bar size','barall'],['stick','Stick length','sel:20=20 ft,40=40 ft,60=60 ft,custom=Custom'],['customLen','Custom length (ft)'],['perBundle','Bars per bundle'],['bundles','# bundles'],['kind','Rate','sel:straight=Straight,fab=Fabricated,epoxy=Epoxy'],['noWaste','No waste (full bundles)','chk']], d:{bar:5,stick:'20',customLen:'',perBundle:'',bundles:1,kind:'straight',noWaste:true}},
  manual:{name:'Manual entry (lb or tons)', f:[['kind','Type','sel:fab=Fabricated,straight=Straight,epoxy=Epoxy'],['lb','Pounds (lb)'],['tons','Tons (T)'],['stock','Stock bar (no shop drawings)','chk'],['noWaste','No waste (0%) on this line','chk']], d:{kind:'fab',lb:'',tons:'',stock:false,noWaste:false}},
  custom:{name:'Custom line', f:[['mark','Mark'],['bar','Bar size',BAR],['count','Count'],['len','Length (ft)'],['hooks','Hooks per bar',HK],['fab','Fabricated (bent)','chk']], d:{mark:'',bar:5,count:10,len:20,hooks:0,fab:false}},
};
const newLine = (type, p) => { const L = newLine0(type, p); if (type === 'bundle' && !(p && p.perBundle)) L.p.perBundle = (S.bundleQty || {})[L.p.bar] ?? ''; return L; };
const newLine0 = (type, p) => ({ id:uid(), type, desc:EL[type].name, ref:'', epoxy:false, optional:false, fab:'auto', laps:true, p:Object.assign({}, EL[type].d, p||{}) });

/* ---------- render helpers ---------- */
function field(k, label, kind, val, dataAttr) {
  const a = `data-${dataAttr}="${k}"`;
  if (kind === 'barall') return `<label>${label}<select ${a}>${BARS_ALL.map(b => `<option value="${b}" ${+val===b?'selected':''}>#${b} (${C.WT[b]} lb/LF)</option>`).join('')}</select></label>`;
  if (kind === BAR) return `<label>${label}<select ${a}>${BARS.map(b => `<option value="${b}" ${+val===b?'selected':''}>#${b}</option>`).join('')}</select></label>`;
  if (kind && kind.startsWith('sel:')) return `<label>${label}<select ${a}>${kind.slice(4).split(',').map(o => { const [v, t] = o.split('='); return `<option value="${v}" ${String(val)===v?'selected':''}>${t||v}</option>`; }).join('')}</select></label>`;
  if (kind === 'chk') return `<label class="chk"><input type="checkbox" ${a} ${val?'checked':''}>${label}</label>`;
  return `<label>${label}<input ${a} inputmode="decimal" value="${esc(val)}"></label>`;
}
function mathTable(t) {
  if (t.rows.length && t.rows[0].manual) return `<div class="eq tot">${esc(t.rows[0].calc)}</div>`;
  if (t.rows.length && t.rows[0].noLap) return `<div class="eq tot">${esc(t.rows[0].calc)}</div><div class="muted">${t.rows[0].count} bars · ${t.s20} x 20' equiv.</div>`;
  if (!t.rows.length) return '<div class="note">Enter the quantities to compute this line.</div>';
  return `<table class="math"><tr><th>Mark</th><th>Math</th><th>Sticks 20'/40'</th></tr>${t.rows.map(r => `<tr><td>${esc(r.mark)}<div class="sub">#${r.bar} ${r.cls}</div></td>
   <td class="eq">${r.count} x ${r.len} ft = ${r.lf.toLocaleString()} LF x ${r.wt} lb/LF = ${r.lb.toLocaleString()} lb<div class="sub">${esc(r.note||r.calc||'')}</div></td><td>${r.s20} / ${r.s40}</td></tr>`).join('')}</table>
   <div class="tot">Line: ${t.lf.toLocaleString()} LF · ${t.lb.toLocaleString()} lb (fab ${t.fabLb.toLocaleString()} / straight ${t.straightLb.toLocaleString()}) · ${t.s20} x 20' · ${t.s40} x 40'</div>`;
}

/* ---------- TAKEOFF ---------- */
function rTakeoff() {
  if (Q.manual) return rManualQuote();
  let tl = 0, tf = 0;
  const dups = dupMap();
  const cards = Q.lines.map((L, i) => { const t = C.takeoff(L, S); tl += t.lb; tf += t.fabLb;
    return `<div class="card" data-line="${L.id}"><div class="lhead"><h3>${i+1}. ${esc(EL[L.type].name)}</h3><button class="btn sm d" data-act="dl">Delete</button></div>
    ${L.src ? `<div class="muted">Source sheet: <b>${esc(L.src.sheet)}</b> (${L.src.kind === 'pdf' ? 'PDF page' : 'photo'})</div>` : ''}
    ${dups[L.id] ? `<div class="dup">⚠ Possible duplicate: same bar size and mark as ${esc(dups[L.id])}. Check you are not counting it twice. <label class="chk"><input type="checkbox" data-dupok>Confirmed, not a duplicate</label></div>` : ''}
    <div class="grid"><label>Description<input data-l="desc" value="${esc(L.desc)}"></label><label>Plan sheet / page ref<input data-l="ref" value="${esc(L.ref)}" placeholder="e.g. S-201 p.14"></label></div>
    <div class="grid">${EL[L.type].f.map(([k, lab, kind]) => field(k, lab, kind, L.p[k], 'p')).join('')}</div>
    ${L.type === 'bundle' && !(+L.p.perBundle > 0) ? '<div class="note">Enter bars per bundle for this size (it is remembered per size).</div>' : ''}
    ${(L.type === 'manual' || L.type === 'bundle') ? `<div>${field('optional','Optional line','chk',L.optional,'l')}</div>` : `<div class="grid"><label>Class<select data-l="fab"><option value="auto" ${L.fab==='auto'?'selected':''}>Auto (bent = fabricated)</option><option value="fab" ${L.fab==='fab'?'selected':''}>All fabricated</option><option value="straight" ${L.fab==='straight'?'selected':''}>All straight</option></select></label>
    <div>${field('epoxy','Epoxy coated','chk',L.epoxy,'l')}${field('optional','Optional line','chk',L.optional,'l')}${field('laps','Carry laps (bars > '+S.maxBar+' ft)','chk',L.laps,'l')}</div></div>`}
    <div class="mt">${mathTable(t)}</div></div>`; }).join('');
  app.innerHTML = `<h2>Takeoff</h2><div class="card"><label class="chk"><input type="checkbox" id="manQ">Manual quote (type line items, no takeoff)</label></div><div class="card"><label>Add element<select id="addType">${Object.entries(EL).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
   <button class="btn p" id="addLine">+ Add line</button><button class="btn" id="imp">Import CSV/JSON</button><button class="btn" id="expCsv">Export CSV</button><button class="btn" id="expJson">Export JSON</button>
   <input type="file" id="impF" accept=".csv,.json,text/csv,application/json" hidden>
   <div class="muted">Laps ${S.lapDb} db · hooks ${S.hookDb} db · stock ${S.maxBar} ft (Settings). Rebar only; concrete by others.</div></div>
   ${Object.keys(dups).length ? `<div class="dup">⚠ ${Object.keys(dups).length} line(s) may be counted on two sheets. Review the flagged lines.</div>` : ''}
   ${cards || '<div class="card muted">No lines yet. Add an element, import a takeoff from the office, or measure on a Plan Photo.</div>'}
   <div class="card tot" id="tkTot">${tkTotal()}</div>`;
  $('#manQ').onchange = e => { if (e.target.checked && Q.lines.length && !confirm('Switch this quote to Manual quote? Takeoff lines are kept but not priced while manual is on.')) { e.target.checked = false; return; } Q.manual = e.target.checked; touch(); rTakeoff(); };
  $('#addLine').onclick = () => { Q.lines.push(newLine($('#addType').value)); touch(); rTakeoff(); window.scrollTo(0, document.body.scrollHeight); };
  $('#imp').onclick = () => $('#impF').click(); $('#impF').onchange = e => importFile(e.target.files[0]);
  $('#expCsv').onclick = () => download(`rebarfab_takeoff_${slug()}.csv`, toCSV(), 'text/csv');
  $('#expJson').onclick = () => download(`rebarfab_takeoff_${slug()}.json`, JSON.stringify(exportObj(), null, 1), 'application/json');
  app.querySelectorAll('[data-line]').forEach(card => { const L = Q.lines.find(x => x.id === card.dataset.line);
    card.addEventListener('input', e => upd(e, L, card)); card.addEventListener('change', e => upd(e, L, card, true));
    const dk = card.querySelector('[data-dupok]'); if (dk) dk.onchange = () => { L.dupOk = true; touch(); rTakeoff(); };
    card.querySelector('[data-act=dl]').onclick = () => { if (confirm('Delete this line?')) { Q.lines = Q.lines.filter(x => x !== L); touch(); rTakeoff(); } }; });
}
function tkTotal() { const P = C.priceQuote(Q, S), lb = Q.lines.reduce((a, L) => a + C.takeoff(L, S).lb, 0);
  return `Takeoff total: ${lb.toLocaleString('en-US', {maximumFractionDigits:2})} lb · ${(lb/2000).toFixed(3)} T before waste · ${P.baseTons} base T with waste<div class="eq">Shop drawings ${esc(P.shopInfo.math)}</div><div class="eq">Trucking ${esc(P.trucking.math)}</div>`; }
function upd(e, L, card, rerender) { const t = e.target, v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.dataset.p) L.p[t.dataset.p] = v; else if (t.dataset.l) L[t.dataset.l] = v; else return;
  const k = t.dataset.p, other = n => card.querySelector(`[data-p=${n}]`);
  if (L.type === 'manual' && (k === 'lb' || k === 'tons')) { const x = parseFloat(v);
    if (k === 'lb') { L.p.tons = isFinite(x) ? +(x / 2000).toFixed(4) : ''; other('tons').value = L.p.tons; } else { L.p.lb = isFinite(x) ? +(x * 2000).toFixed(2) : ''; other('lb').value = L.p.lb; } }
  if (L.type === 'bundle') { S.bundleQty ||= {};
    if (k === 'perBundle' && +v > 0) { S.bundleQty[L.p.bar] = +v; saveS(); }
    if (k === 'bar' && rerender) { L.p.perBundle = S.bundleQty[v] ?? ''; touch(); return rTakeoff(); }
    if (k === 'perBundle' && rerender) { touch(); return rTakeoff(); } }
  touch(); card.querySelector('.mt').innerHTML = mathTable(C.takeoff(L, S)); const tt = $('#tkTot'); if (tt) tt.innerHTML = tkTotal(); }

/* ---------- duplicates across sheets ---------- */
function lineBars(L) { return [...new Set(['bar','vBar','hBar','tieBar'].map(k => L.p[k]).filter(Boolean).map(Number))].sort((a, b) => a - b).join('/'); }
function dupMap() { const g = {}, out = {}; Q.lines.forEach((L, i) => { if (!L.src || !L.src.sheetId) return; const key = L.type + '|' + lineBars(L) + '|' + String(L.desc || '').toLowerCase().replace(/[^a-z0-9#@]+/g, ' ').trim(); (g[key] ||= []).push(i); });
  Object.values(g).forEach(ix => { const sheets = new Set(ix.map(i => Q.lines[i].src.sheetId)); if (sheets.size < 2) return;
    ix.forEach(i => { const L = Q.lines[i]; if (L.dupOk) return; out[L.id] = ix.filter(j => j !== i && Q.lines[j].src.sheetId !== L.src.sheetId).map(j => `line ${j+1} (${Q.lines[j].src.sheet})`).join(', '); }); });
  return out; }

/* ---------- MANUAL QUOTE ---------- */
function rManualQuote() { const P = C.priceManual(Q);
  app.innerHTML = `<h2>Manual quote</h2><div class="card"><label class="chk"><input type="checkbox" id="manQ" checked>Manual quote (type line items, no takeoff)</label>
   <div class="muted">No takeoff and no auto rates: totals add up what you type. Material = qty x unit sell unless you type a Material $. Tons come from LB/T qty, or type tons for $/T and $/lb.</div>
   <button class="btn p" id="addM">+ Add line item</button><button class="btn" id="expCsv">Export CSV</button><button class="btn" id="expJson">Export JSON</button><button class="btn" id="imp">Import</button><input type="file" id="impF" accept=".csv,.json" hidden></div>
   ${Q.mlines.map((M, i) => { const l = P.lines[i]; return `<div class="card" data-ml="${i}"><div class="lhead"><h3>${i+1}. Line item</h3><button class="btn sm d" data-mdl>Delete</button></div>
    <div class="grid"><label>Description<input data-m="desc" value="${esc(M.desc)}"></label><label>Plan ref<input data-m="ref" value="${esc(M.ref)}"></label>
    <label>Qty<input data-m="qty" inputmode="decimal" value="${esc(M.qty)}"></label><label>Unit<select data-m="unit">${C.UNITS.map(u => `<option ${M.unit===u?'selected':''}>${u}</option>`).join('')}</select></label>
    <label>Unit sell $<input data-m="price" inputmode="decimal" value="${esc(M.price)}"></label>${(M.unit==='LB'||M.unit==='T') ? '' : `<label>Tons (for $/T)<input data-m="tons" inputmode="decimal" value="${esc(M.tons)}"></label>`}
    <label>Material $ (optional)<input data-m="mat" inputmode="decimal" value="${esc(M.mat)}" placeholder="${l.ext.toFixed(2)}"></label><label>Trucking $<input data-m="truck" inputmode="decimal" value="${esc(M.truck)}"></label>
    <label>Shop Drawings $<input data-m="shop" inputmode="decimal" value="${esc(M.shop)}"></label><label class="chk"><input type="checkbox" data-m="optional" ${M.optional?'checked':''}>Optional</label></div>
    <div class="eq tot">${esc(l.math)}${l.tons>0 ? ` · ${C.money(l.perTon)}/T · $${l.perLb.toFixed(4)}/lb` : ''}</div></div>`; }).join('') || '<div class="card muted">No line items yet.</div>'}
   <div class="card tot">Base ${C.money(P.baseTotal)} · Optional ${C.money(P.optTotal)} · Grand ${C.money(P.grand)}</div>`;
  $('#manQ').onchange = e => { Q.manual = e.target.checked; touch(); rTakeoff(); };
  $('#addM').onclick = () => { Q.mlines.push({id:uid(), desc:'', ref:'', qty:'', unit:'T', price:'', mat:'', truck:'', shop:'', tons:'', optional:false}); touch(); rManualQuote(); };
  $('#imp').onclick = () => $('#impF').click(); $('#impF').onchange = e => importFile(e.target.files[0]);
  $('#expCsv').onclick = () => download(`rebarfab_quote_${slug()}.csv`, toCSV(), 'text/csv');
  $('#expJson').onclick = () => download(`rebarfab_quote_${slug()}.json`, JSON.stringify(exportObj(), null, 1), 'application/json');
  app.querySelectorAll('[data-ml]').forEach(c => { const M = Q.mlines[+c.dataset.ml];
    c.addEventListener('change', e => { const t = e.target; if (!t.dataset.m) return; M[t.dataset.m] = t.type === 'checkbox' ? t.checked : t.value; touch(); const y = scrollY; rManualQuote(); scrollTo(0, y); });
    c.querySelector('[data-mdl]').onclick = () => { if (confirm('Delete this line item?')) { Q.mlines.splice(+c.dataset.ml, 1); touch(); rManualQuote(); } }; });
}

/* ---------- import / export ---------- */
const CSV_COLS = ['line_no','element','description','sheet_ref','epoxy','optional','class_override','carry_laps','mark','bar','count','length_ft','lf','lb_per_lf','lb','sticks_20','sticks_40','class','math','params_json','override_per_lb','source_sheet'];
const slug = () => (Q.project || 'quote').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
const csvCell = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const MCSV_COLS = ['line_no','description','sheet_ref','qty','unit','unit_price','material','trucking','shop_drawings','tons','optional','total'];
function toCSV() { if (Q.manual) { const P = C.priceManual(Q); return [MCSV_COLS.join(',')].concat(Q.mlines.map((M, i) => [i+1, M.desc, M.ref, M.qty, M.unit, M.price, M.mat, M.truck, M.shop, M.tons, M.optional?1:0, P.lines[i].total].map(csvCell).join(','))).join('\r\n'); }
  const out = [CSV_COLS.join(',')];
  Q.lines.forEach((L, i) => C.takeoff(L, S).rows.forEach((r, j) => out.push([i+1, L.type, L.desc, L.ref, L.epoxy?1:0, L.optional?1:0, L.fab, L.laps?1:0, r.mark, r.bar, r.count, r.len, r.lf, r.wt, r.lb, r.s20, r.s40, r.cls,
    `${r.count} x ${r.len} = ${r.lf} LF x ${r.wt} = ${r.lb} lb`, j === 0 ? JSON.stringify(L.p) : '', j === 0 ? (L.ovPerLb || '') : '', L.src ? L.src.sheet : ''].map(csvCell).join(','))));
  out.push(''); out.push(['#trucking', Q.trucking.mode, Q.trucking.manualBy, Q.trucking.total, Q.trucking.loads, Q.trucking.perLoad].map(csvCell).join(','));
  out.push(['#shop', Q.shop.mode, Q.shop.rate, Q.shop.flat].map(csvCell).join(','));
  out.push(['#override', JSON.stringify(Q.ov || {})].map(csvCell).join(','));
  Q.acc.forEach(a => out.push(['#accessory', a.id, a.item, a.unit, a.qty, a.sell, a.optional?1:0].map(csvCell).join(',')));
  return out.join('\r\n'); }
function parseCSV(text) { const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"' && text[i+1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }
function fromCSV(text) { const rows = parseCSV(text).filter(r => r.some(c => c !== '')); const H = rows.shift().map(h => h.trim().toLowerCase()); const ix = k => H.indexOf(k);
  if (H.includes('unit_price')) { const g = (r, k) => ix(k) >= 0 ? r[ix(k)] : ''; return { lines:[], manual:true, mlines:rows.map(r => ({id:uid(), desc:g(r,'description'), ref:g(r,'sheet_ref'), qty:g(r,'qty'), unit:(g(r,'unit')||'T').toUpperCase(), price:g(r,'unit_price'), mat:g(r,'material'), truck:g(r,'trucking'), shop:g(r,'shop_drawings'), tons:g(r,'tons'), optional:g(r,'optional')==='1'})) }; }
  const lines = [], byNo = {}, acc = []; let trucking = null, ov = null, shop = null;
  rows.forEach(r => { if (r[0] === '#trucking') { trucking = {mode:r[1]||'auto', manualBy:r[2]||'total', total:r[3], loads:r[4], perLoad:r[5]||S.truckPerLoad}; return; }
    if (r[0] === '#shop') { shop = {mode:r[1]||'auto', rate:r[2]||'', flat:r[3]||''}; return; }
    if (r[0] === '#override') { try { ov = JSON.parse(r[1]); } catch (e) {} return; }
    if (r[0] === '#accessory') { const base = ACC.find(a => a.id == r[1]) || {}; acc.push({id:+r[1], item:r[2], unit:r[3], qty:+r[4], sell:+r[5], cost:base.cost||0, optional:r[6]==='1'}); return; }
    const g = k => ix(k) >= 0 ? r[ix(k)] : ''; const no = g('line_no') || String(lines.length + 1);
    if (byNo[no]) return; // computed rows after the first are regenerated from params
    const type = EL[g('element')] ? g('element') : 'custom'; let p = null; try { p = g('params_json') ? JSON.parse(g('params_json')) : null; } catch (e) {}
    if (!p) p = { mark:g('mark'), bar:+String(g('bar')).replace('#',''), count:+g('count'), len:+g('length_ft'), hooks:0, fab:/fab/i.test(g('class')) };
    const L = newLine(p.mark !== undefined && type === 'custom' ? 'custom' : type, p); L.desc = g('description') || L.desc; L.ref = g('sheet_ref'); L.epoxy = g('epoxy') === '1'; L.optional = g('optional') === '1';
    L.fab = g('class_override') || 'auto'; L.ovPerLb = g('override_per_lb') || ''; if (g('source_sheet')) L.src = {sheetId:'import:' + g('source_sheet'), sheet:g('source_sheet'), kind:'import'}; L.laps = g('carry_laps') !== '0'; byNo[no] = L; lines.push(L); });
  // a plain bar list (no params) gives one custom line per row
  return { lines, acc, trucking, ov, shop }; }
function exportObj() { return { app:'Rebar-Fab Field Quote', schema:1, exported:new Date().toISOString(), settings:S, quote:Object.assign({}, Q, {photos:undefined}),
  takeoff:Q.lines.map(L => Object.assign({}, L, {computed:C.takeoff(L, S)})) }; }
async function importFile(f) { if (!f) return; const text = await f.text(); let got;
  try { if (/\.json$/i.test(f.name) || text.trim().startsWith('{')) { const o = JSON.parse(text); const q = o.quote || o; got = { lines:(q.lines || o.takeoff || []).map(L => Object.assign(newLine(L.type in EL ? L.type : 'custom'), L, {id:uid(), computed:undefined})), acc:q.acc || [], trucking:q.trucking, ov:q.ov, shop:q.shop, meta:q, manual:!!q.manual, mlines:q.mlines || [] }; }
    else got = fromCSV(text); } catch (e) { alert('Could not read file: ' + e.message); return; }
  const nIn = got.lines.length + (got.mlines || []).length;
  const replace = (Q.lines.length || Q.mlines.length) ? confirm(`Import ${nIn} line(s). OK = start a new quote with them, Cancel = add to this quote.`) : true;
  if (replace) { await put('quotes', Q); Q = newQuote(); if (got.meta) ['customer','project','date','rep','notes','location','phone','email','no','showCredit'].forEach(k => { if (got.meta[k]) Q[k] = got.meta[k]; }); }
  if (got.manual) { Q.manual = true; Q.mlines.push(...got.mlines.map(M => Object.assign({}, M, {id:uid()}))); }
  Q.lines.push(...got.lines); Q.acc.push(...(got.acc || [])); if (got.trucking) Q.trucking = Object.assign(Q.trucking, got.trucking); if (got.shop) Q.shop = got.shop; if (got.ov) Q.ov = Object.assign(Q.ov || {}, got.ov); touch(); rTakeoff(); }
function download(name, data, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], {type})); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }

/* ---------- PRICE (internal) ---------- */
const RLAB = {fab:['Fabricated $/lb',4],straight:['Straight $/lb',4],epoxy:['Epoxy $/lb',4],markupPct:['Markup %',2],wastePct:['Waste %',2],truckPerLoad:['Trucking $/load',2],tonsPerLoad:['Tons per load',2],shopPerTon:['Shop drawings $/T',2]};
function ovCard(P) { const o = Q.ov;
  const rows = C.RATE_KEYS.map(k => { const mkt = S[k], has = o[k] !== undefined && o[k] !== '', v = parseFloat(o[k]); const d = has ? v - mkt : 0;
    return `<label style="${has?'background:#fff3c4;border-radius:8px;padding:4px':''}">${RLAB[k][0]}<input data-ov="${k}" inputmode="decimal" value="${esc(o[k] ?? '')}" placeholder="market ${mkt}">
      <span class="sub">${has ? `Market ${mkt} · diff ${d>=0?'+':''}${d.toFixed(RLAB[k][1])} (${mkt?((d/mkt*100).toFixed(1)):'—'}%)` : 'Market rate'}</span></label>`; }).join('');
  const sol = P.s.solved;
  return `<div class="card"><h3>Quote rate overrides</h3><div class="muted">Blank = market rate from Settings. Overrides save with this quote and export.</div><div class="grid">${rows}</div>
   <h3 style="margin-top:10px">Target sell (back-solves markup)</h3><div class="grid"><label style="${o.targetPerLb?'background:#fff3c4;border-radius:8px;padding:4px':''}">Target base $/lb<input data-ov="targetPerLb" inputmode="decimal" value="${esc(o.targetPerLb ?? '')}"></label>
   <label style="${o.targetPerTon?'background:#fff3c4;border-radius:8px;padding:4px':''}">Target base $/T<input data-ov="targetPerTon" inputmode="decimal" value="${esc(o.targetPerTon ?? '')}"></label></div>
   ${sol ? `<div class="eq tot">${esc(sol.math)} = ${sol.markupPct.toFixed(2)}% (market ${S.markupPct}%)</div>` : ''}
   <button class="btn sm" id="ovClr">Clear all overrides</button></div>`; }
function rPrice() { if (Q.manual) { app.innerHTML = `<h2>Price</h2><div class="card">This is a <b>Manual quote</b>: there are no auto rates. Edit the line items on the Takeoff tab.</div>`; return; }
  const P = C.priceQuote(Q, S), T = Q.trucking;
  const warn = P.lines.filter(l => l.belowCost), accW = P.acc.filter(a => a.sell < a.cost - 0.005);
  const slabs = Q.lines.filter(l => l.type === 'slab');
  app.innerHTML = `<h2>Price (internal)</h2>
  ${(warn.length || accW.length || P.s.markupPct <= 0) ? `<div class="note" style="background:#fde8e8;border-color:#e99">⚠ Sell at or below cost: ${P.s.markupPct <= 0 ? `quote markup is ${P.s.markupPct.toFixed(2)}%. ` : ''}${warn.map(l => esc(l.line.desc)).concat(accW.map(a => esc(a.a.item))).join(', ')}</div>` : ''}
  ${ovCard(P)}
  <div class="card"><h3>Trucking</h3><div class="row"><button class="btn ${T.mode==='auto'?'on':''}" data-tm="auto">Auto</button><button class="btn ${T.mode==='manual'?'on':''}" data-tm="manual">Manual</button></div>
   ${T.mode === 'manual' ? `<div class="row"><label class="chk"><input type="radio" name="mb" value="total" ${T.manualBy==='total'?'checked':''}>Total $</label><label class="chk"><input type="radio" name="mb" value="loads" ${T.manualBy==='loads'?'checked':''}>Loads x $/load</label></div>
     ${T.manualBy === 'total' ? `<label>Trucking total ($)<input data-t="total" inputmode="decimal" value="${esc(T.total)}"></label>` : `<div class="grid"><label>Loads<input data-t="loads" inputmode="decimal" value="${esc(T.loads)}"></label><label>$ per load<input data-t="perLoad" inputmode="decimal" value="${esc(T.perLoad)}"></label></div>`}` : ''}
   <div class="eq tot">${esc(P.trucking.math)} = ${C.money(P.trucking.amt)}</div><div class="muted">Base tons ${P.baseTons} (with ${S.wastePct}% waste). Allocated to base lines by tonnage; optional lines carry their own ROUNDUP(T/${S.tonsPerLoad}) loads.</div></div>
  <div class="card"><h3>Shop drawings</h3><div class="row">${[['auto','Auto'],['rate','Rate'],['flat','Flat $'],['off','Off']].map(([k, t]) => `<button class="btn sm ${Q.shop.mode===k?'on':''}" data-sd="${k}">${t}</button>`).join('')}</div>
   ${Q.shop.mode === 'rate' ? `<label>Shop drawings $/T (this quote)<input data-sdv="rate" inputmode="decimal" value="${esc(Q.shop.rate)}" placeholder="market ${S.shopPerTon}"></label>` : ''}${Q.shop.mode === 'flat' ? `<label>Flat shop drawings $<input data-sdv="flat" inputmode="decimal" value="${esc(Q.shop.flat)}"></label>` : ''}
   <div class="eq tot" id="sdMath">${esc(P.shopInfo.math)}</div><div class="muted">Fabricated tons only (with waste): calculated fabricated bars and manual lines marked fabricated. Bundles and stock/straight bar carry no shop drawings.</div></div>
  <div class="card"><h3>Lines</h3><table class="math"><tr><th>Line</th><th>Math</th></tr>${P.lines.map((l, i) => `<tr><td>${i+1}. ${esc(l.line.desc)}${l.optional?' <b>(opt)</b>':''}${l.line.src?`<div class="sub">Sheet ${esc(l.line.src.sheet)}</div>`:''}${l.line.ref?`<div class="sub">Ref ${esc(l.line.ref)}</div>`:''}<div class="sub">${l.lbW.toLocaleString()} lb · ${l.tons.toFixed(3)} T</div></td>
    <td class="eq">Material: ${esc(l.priceMath)}<br>Trucking: ${esc(l.truckMath)} = ${C.money(l.trucking)}<br>Shop dwg: ${esc(l.shopMath)}<br><b>Total ${C.money(l.total)} · ${C.money(l.perTon)}/T · $${l.perLb.toFixed(4)}/lb</b><div class="sub">Cost ${C.money(l.cost)}${l.belowCost?' <b style="color:#9b1c1c">BELOW COST</b>':''}</div>
    <label style="${l.line.ovPerLb>0?'background:#fff3c4;border-radius:8px;padding:4px':''}">Line override sell $/lb (material)<input data-lov="${l.line.id}" inputmode="decimal" value="${esc(l.line.ovPerLb || '')}" placeholder="${l.lbW ? (l.material/l.lbW).toFixed(4) : ''}">
    ${l.line.ovPerLb>0 ? (() => { const mk = C.priceQuote(Object.assign({}, Q, {lines:[Object.assign({}, l.line, {ovPerLb:''})], acc:[]}), S).lines[0]; const d = l.material - mk.material; return `<span class="sub">Rate-based ${C.money(mk.material)} · diff ${d>=0?'+':'-'}${C.money(Math.abs(d))} (${mk.material?(d/mk.material*100).toFixed(1):'—'}%)</span>`; })() : ''}</label></td></tr>`).join('')}</table></div>
  <div class="card"><h3>Accessories</h3>
   <label>Item<select id="accSel">${ACC.map(a => `<option value="${a.id}">${esc(a.item)} — ${esc(a.unit)} · sell ${C.money(a.sell)}</option>`).join('')}</select></label>
   <div class="grid"><label>Qty<input id="accQty" inputmode="decimal" value="1"></label><label class="chk"><input type="checkbox" id="accOpt">Optional</label></div><button class="btn p" id="accAdd">+ Add accessory</button>
   ${slabs.length ? `<div class="note">Suggested at a 4'x4' grid:<br>${slabs.map(l => { const g = C.chairGrid(l.p.L, l.p.W, l.p.layers); return `${esc(l.desc)}: ${g.math} → ${g.dobies} dobies${g.chairs?`, ${g.chairs} chairs for top mat`:''} <button class="btn sm" data-sug="${l.id}">Add</button>`; }).join('<br>')}</div>` : ''}
   <table class="math">${P.acc.map((a, i) => `<tr><td>${esc(a.a.item)}${a.optional?' (opt)':''}<div class="sub">cost ${C.money(a.cost)} · markup ${a.a.markup_pct ?? ''}%</div></td><td class="eq">${esc(a.math)}</td><td><button class="btn sm d" data-adel="${i}">X</button></td></tr>`).join('')}</table></div>
  <div class="card tot">Base ${C.money(P.baseTotal)} · Optional ${C.money(P.optTotal)} · Grand ${C.money(P.grand)}<div class="muted">Internal cost ${C.money(P.internalCost)} + trucking/shop. Markup ${P.s.markupPct.toFixed(2)}% on material${S.markupFreightShop?', trucking and shop drawings':''}.</div></div>`;
  app.querySelectorAll('[data-ov]').forEach(i => i.onchange = () => { const k = i.dataset.ov; if (i.value.trim() === '') delete Q.ov[k]; else Q.ov[k] = i.value.trim();
    if (k === 'targetPerLb' && Q.ov[k]) delete Q.ov.targetPerTon; if (k === 'targetPerTon' && Q.ov[k]) delete Q.ov.targetPerLb; touch(); rPrice(); });
  $('#ovClr').onclick = () => { Q.ov = {}; Q.lines.forEach(l => l.ovPerLb = ''); touch(); rPrice(); };
  app.querySelectorAll('[data-lov]').forEach(i => i.onchange = () => { Q.lines.find(l => l.id === i.dataset.lov).ovPerLb = i.value.trim(); touch(); rPrice(); });
  app.querySelectorAll('[data-sd]').forEach(b => b.onclick = () => { Q.shop.mode = b.dataset.sd; touch(); rPrice(); });
  app.querySelectorAll('[data-sdv]').forEach(i => i.oninput = () => { Q.shop[i.dataset.sdv] = i.value; touch(); $('#sdMath').textContent = C.priceQuote(Q, S).shopInfo.math; });
  app.querySelectorAll('[data-sdv]').forEach(i => i.onchange = () => rPrice());
  app.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { T.mode = b.dataset.tm; touch(); rPrice(); });
  app.querySelectorAll('[name=mb]').forEach(b => b.onchange = () => { T.manualBy = b.value; touch(); rPrice(); });
  app.querySelectorAll('[data-t]').forEach(i => i.onchange = () => { T[i.dataset.t] = i.value; touch(); rPrice(); });
  $('#accAdd').onclick = () => { const a = ACC.find(x => x.id == $('#accSel').value); Q.acc.push(Object.assign({}, a, {qty:+$('#accQty').value || 0, optional:$('#accOpt').checked})); touch(); rPrice(); };
  app.querySelectorAll('[data-adel]').forEach(b => b.onclick = () => { Q.acc.splice(+b.dataset.adel, 1); touch(); rPrice(); });
  app.querySelectorAll('[data-sug]').forEach(b => b.onclick = () => { const l = Q.lines.find(x => x.id === b.dataset.sug), g = C.chairGrid(l.p.L, l.p.W, l.p.layers);
    const dob = ACC.find(a => /Dobie/i.test(a.item)), ch = ACC.find(a => /Plastic chairs - 3 1\/4/.test(a.item));
    if (dob) Q.acc.push(Object.assign({}, dob, {qty:g.dobies, item:dob.item + ` (${l.desc}, 4'x4' grid)`}));
    if (g.chairs && ch) Q.acc.push(Object.assign({}, ch, {qty:Math.ceil(g.chairs / 500), item:ch.item + ` (${g.chairs} pcs, ${l.desc})`}));
    touch(); rPrice(); });
}

/* ---------- QUOTE (customer copy, sell only) ---------- */
function quoteText(P) { const m = C.money, base = P.lines.filter(l => !l.optional), sum = k => base.reduce((a, l) => a + l[k], 0) ;
  const mat = sum('material') + P.acc.filter(a => !a.optional).reduce((a, x) => a + x.sell, 0), tr = base.length ? sum('trucking') : P.trucking.amt, sh = sum('shop');
  return `Rebar-Fab Quote ${Q.no}\nJob: ${Q.project}${Q.location ? '\nLocation: ' + Q.location : ''}\nCustomer: ${Q.customer}\nDate: ${Q.date}\n\nMaterial: ${m(mat)}\nTrucking: ${m(tr)}\nShop Drawings: ${m(sh)}\nBase Total: ${m(P.baseTotal)}${P.baseLb ? ` (${(P.baseLb/2000).toFixed(2)} T, ${m(P.baseTotal/(P.baseLb/2000))}/T)` : ''}${P.optTotal ? `\nOptional items: ${m(P.optTotal)}\nGrand Total: ${m(P.grand)}` : ''}\n\nExclusions: Concrete by others.\nPrices firm 30 days, then +$1.50/cwt per quarter on unshipped tons; tariffs passed through.\n\n${Q.rep}\nRebar-Fab · ${COMPANY.addr1}, ${COMPANY.addr2}\nMain ${COMPANY.main} · Direct ${COMPANY.direct} · ${COMPANY.email}`; }
function mailtoHref(P) { return 'mailto:' + encodeURIComponent(Q.email || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent(`Rebar-Fab Quote ${Q.no} - ${Q.project || 'Job'}`) + '&body=' + encodeURIComponent(quoteText(P)); }
function loadScript(src) { return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); }); }
async function quotePDF(P) { await loadScript('lib/jspdf.umd.min.js'); await loadScript('lib/jspdf.plugin.autotable.min.js');
  const { jsPDF } = window.jspdf, d = new jsPDF({unit:'pt', format:'letter'}), m = C.money, W = 612;
  const logo = await fetch('logo.png').then(r => r.blob()).then(b => new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); }));
  d.addImage(logo, 'PNG', 36, 30, 170, 65); d.setFontSize(9); d.setFont('helvetica', 'bold'); d.text('Rebar-Fab', W - 36, 40, {align:'right'}); d.setFont('helvetica', 'normal');
  [COMPANY.addr1, COMPANY.addr2, 'Main ' + COMPANY.main, 'Joe direct ' + COMPANY.direct, COMPANY.email].forEach((t, i) => d.text(t, W - 36, 52 + i * 11, {align:'right'}));
  d.setDrawColor(31, 56, 100); d.setLineWidth(2); d.line(36, 104, W - 36, 104); d.setFontSize(9.5);
  const L = [['Quote #', Q.no], ['Customer', Q.customer], ['Job / project', Q.project], ['Job location', Q.location], ['Phone', Q.phone], ['Email', Q.email]], Rr = [['Date', Q.date], ['Sales rep', Q.rep]];
  L.forEach(([k, v], i) => { d.setFont('helvetica', 'bold'); d.text(k + ':', 36, 120 + i * 12); d.setFont('helvetica', 'normal'); d.text(String(v || ''), 110, 120 + i * 12); });
  Rr.forEach(([k, v], i) => { d.setFont('helvetica', 'bold'); d.text(k + ':', 380, 120 + i * 12); d.setFont('helvetica', 'normal'); d.text(String(v || ''), 440, 120 + i * 12); });
  const base = P.lines.filter(l => !l.optional), opt = P.lines.filter(l => l.optional), body = []; let n = 0;
  const row = l => [`${++n}. ${l.line.desc}${l.line.epoxy ? ' (epoxy)' : ''}\n${l.tons > 0 ? l.lbW.toLocaleString() + ' lb · ' + l.tons.toFixed(2) + ' T' : (l.line.qtyText || '')}${Q.showRefs && l.line.src ? ' · Sheet ' + l.line.src.sheet : ''}${Q.showRefs && l.line.ref ? ' · Ref ' + l.line.ref : ''}`, m(l.material), m(l.trucking), m(l.shop), m(l.total), l.tons > 0 ? m(l.perTon) : '', l.tons > 0 ? '$' + l.perLb.toFixed(4) : ''];
  const accR = a => [`${a.a.item}\n${a.a.qty} ${a.a.unit || ''}`, m(a.sell), '', '', m(a.sell), '', ''];
  base.forEach(l => body.push(row(l))); P.acc.filter(a => !a.optional).forEach(a => body.push(accR(a)));
  const bs = k => base.reduce((a, l) => a + l[k], 0);
  body.push([{content:`Base Total${P.baseLb ? ` (${(P.baseLb/2000).toFixed(2)} T)` : ''}`, styles:{fontStyle:'bold'}}, ...[bs('material') + P.acc.filter(a => !a.optional).reduce((a, x) => a + x.sell, 0), base.length ? bs('trucking') : P.trucking.amt, bs('shop'), P.baseTotal].map(v => ({content:m(v), styles:{fontStyle:'bold'}})), P.baseLb ? m(P.baseTotal/(P.baseLb/2000)) : '', P.baseLb ? '$' + (P.baseTotal/P.baseLb).toFixed(4) : '']);
  const baseRow = body.length - 1;
  if (opt.length || P.acc.some(a => a.optional)) { body.push([{content:'Optional items (not included in base)', colSpan:7, styles:{fillColor:[238,241,246], fontStyle:'bold'}}]);
    opt.forEach(l => body.push(row(l))); P.acc.filter(a => a.optional).forEach(a => body.push(accR(a)));
    body.push([{content:'Optional Total', styles:{fontStyle:'bold'}}, '', '', '', {content:m(P.optTotal), styles:{fontStyle:'bold'}}, '', '']); }
  body.push([{content:'Grand Total' + (P.optTotal ? ' (base + optional)' : ''), styles:{fontStyle:'bold', fontSize:11}}, '', '', '', {content:m(P.grand), styles:{fontStyle:'bold', fontSize:11}}, '', '']);
  const grandRow = body.length - 1;
  d.autoTable({ startY:196, head:[['Item', 'Material', 'Trucking', 'Shop Drawings', 'Total', '$/T', '$/lb']], body, theme:'plain', styles:{fontSize:8.5, cellPadding:4}, headStyles:{fillColor:[31,56,100], textColor:255, halign:'right'},
    columnStyles:{0:{cellWidth:170}, 1:{halign:'right'}, 2:{halign:'right'}, 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}}, margin:{left:36, right:36},
    didParseCell:h => { if (h.section === 'head' && h.column.index === 0) h.cell.styles.halign = 'left'; },
    didDrawCell:h => { if (h.section !== 'body') return; const c = h.cell; d.setDrawColor(0);
      if (h.row.index === baseRow) { d.setLineWidth(1.2); d.line(c.x, c.y, c.x + c.width, c.y); }
      else if (h.row.index === grandRow) { d.setLineWidth(0.8); [0, 3].forEach(o => { d.line(c.x, c.y + o, c.x + c.width, c.y + o); d.line(c.x, c.y + c.height - o, c.x + c.width, c.y + c.height - o); }); }
      else { d.setDrawColor(221); d.setLineWidth(0.5); d.line(c.x, c.y + c.height, c.x + c.width, c.y + c.height); } } });
  let y = d.lastAutoTable.finalY + 20; d.setFontSize(9);
  const para = (b, t) => { d.setFont('helvetica', 'bold'); d.text(b, 36, y); d.setFont('helvetica', 'normal'); const lines = d.splitTextToSize(t, W - 72 - 70); d.text(lines, 106, y); y += lines.length * 11 + 6; };
  if (Q.notes) para('Notes:', Q.notes);
  para('Exclusions:', 'Concrete by others. Placing, sales tax, and items not listed are excluded unless shown above.');
  para('Escalation:', 'Prices are firm for 30 days from the quote date. After 30 days, unshipped tons escalate +$1.50/cwt per quarter. Tariffs, if any, are passed through.');
  if (Q.showCredit) { d.setFontSize(7); d.setTextColor(120); d.text(CREDIT, 36, y + 4); d.setTextColor(0); }
  return d.output('blob'); }
function rQuote() { const P = C.priceAny(Q, S), m = C.money;
  const rowH = (l, i) => `<tr><td>${i}. ${esc(l.line.desc)}${l.line.epoxy?' (epoxy)':''}<div class="muted">${l.tons > 0 ? l.lbW.toLocaleString() + ' lb · ' + l.tons.toFixed(2) + ' T' : esc(l.line.qtyText || '')}${Q.showRefs && l.line.src ? ' · Sheet ' + esc(l.line.src.sheet) : ''}${Q.showRefs && l.line.ref ? ' · Ref ' + esc(l.line.ref) : ''}</div></td><td class="num">${m(l.material)}</td><td class="num">${m(l.trucking)}</td><td class="num">${m(l.shop)}</td><td class="num"><b>${m(l.total)}</b></td><td class="num">${l.tons > 0 ? m(l.perTon) : ''}</td><td class="num">${l.tons > 0 ? '$' + l.perLb.toFixed(4) : ''}</td></tr>`;
  const accH = a => `<tr><td>${esc(a.a.item)}<div class="muted">${a.a.qty} ${esc(a.a.unit||'')}</div></td><td class="num">${m(a.sell)}</td><td></td><td></td><td class="num"><b>${m(a.sell)}</b></td><td></td><td></td></tr>`;
  const base = P.lines.filter(l => !l.optional), opt = P.lines.filter(l => l.optional);
  const tel = Q.phone ? `<a href="tel:${esc(Q.phone.replace(/[^\d+]/g, ''))}">${esc(Q.phone)}</a>` : '', mail = Q.email ? `<a href="mailto:${esc(Q.email)}">${esc(Q.email)}</a>` : '';
  let n = 0;
  app.innerHTML = `<div class="noprint"><h2>Quote ${esc(Q.no)}${Q.manual ? ' · manual' : ''}</h2><div class="card"><h3>Customer</h3><div class="grid">
    <label>Customer name<input data-q="customer" value="${esc(Q.customer)}" autocomplete="organization"></label><label>Job / project<input data-q="project" value="${esc(Q.project)}"></label>
    <label>Job location / address<input data-q="location" value="${esc(Q.location)}" autocomplete="street-address"></label><label>Phone<input data-q="phone" type="tel" inputmode="tel" value="${esc(Q.phone)}"></label>
    <label>Email<input data-q="email" type="email" inputmode="email" value="${esc(Q.email)}"></label><label>Quote #<input data-q="no" value="${esc(Q.no)}"></label>
    <label>Date<input type="date" data-q="date" value="${esc(Q.date)}"></label><label>Sales rep<input data-q="rep" value="${esc(Q.rep)}"></label></div>
    <label>Notes (customer copy)<textarea data-q="notes" rows="2">${esc(Q.notes)}</textarea></label>
    <label class="chk"><input type="checkbox" data-qc ${Q.showCredit?'checked':''}>Show designer credit on quote</label><label class="chk"><input type="checkbox" data-qr ${Q.showRefs?'checked':''}>Show plan sheets / refs on customer copy</label>
    <a class="btn p" id="mailq" href="${esc(mailtoHref(P))}">✉ Email Quote</a><button class="btn" id="sharePdf">Share PDF</button><button class="btn" id="dlPdf">Download PDF</button><button class="btn" id="pdf">Print</button><button class="btn" id="share">Share text</button><button class="btn" id="csv2">CSV</button>
    <div class="muted">Email Quote opens your mail app with the customer as recipient; nothing sends until you press Send.${Q.email ? '' : ' Add the customer email above to pre-fill the recipient.'}</div></div></div>
  <div class="quote scr printme"><div class="qhead"><img src="logo.png" alt="Rebar-Fab"><div class="addr"><b>Rebar-Fab</b><br>${COMPANY.addr1}<br>${COMPANY.addr2}<br>Main <a href="tel:+18179080069">${COMPANY.main}</a><br>Joe direct <a href="tel:+18177982483">${COMPANY.direct}</a><br><a href="mailto:${COMPANY.email}">${COMPANY.email}</a></div></div>
   <div class="grid" style="margin-bottom:8px"><div><b>Quote #:</b> ${esc(Q.no)}<br><b>Customer:</b> ${esc(Q.customer)}<br><b>Job:</b> ${esc(Q.project)}${Q.location ? `<br><b>Location:</b> ${esc(Q.location)}` : ''}${tel ? `<br><b>Phone:</b> ${tel}` : ''}${mail ? `<br><b>Email:</b> ${mail}` : ''}</div><div><b>Date:</b> ${esc(Q.date)}<br><b>Sales rep:</b> ${esc(Q.rep)}</div></div>
   <div class="qscroll"><table class="qt"><tr><th>Item</th><th>Material</th><th>Trucking</th><th>Shop Drawings</th><th>Total</th><th>$/T</th><th>$/lb</th></tr>
   ${base.map(l => rowH(l, ++n)).join('')}${P.acc.filter(a => !a.optional).map(accH).join('')}
   <tr class="base"><td>Base Total${P.baseLb ? ` (${(P.baseLb/2000).toFixed(2)} T)` : ''}</td><td class="num">${m(base.reduce((a,l)=>a+l.material,0)+P.acc.filter(a=>!a.optional).reduce((a,x)=>a+x.sell,0))}</td><td class="num">${m(base.length?base.reduce((a,l)=>a+l.trucking,0):P.trucking.amt)}</td><td class="num">${m(base.reduce((a,l)=>a+l.shop,0))}</td><td class="num">${m(P.baseTotal)}</td><td class="num">${P.baseLb?m(P.baseTotal/(P.baseLb/2000)):''}</td><td class="num">${P.baseLb?'$'+(P.baseTotal/P.baseLb).toFixed(4):''}</td></tr>
   ${(opt.length || P.acc.some(a => a.optional)) ? `<tr class="sect"><td colspan="7">Optional items (not included in base)</td></tr>${opt.map(l => rowH(l, ++n)).join('')}${P.acc.filter(a => a.optional).map(accH).join('')}
   <tr class="base"><td>Optional Total</td><td></td><td></td><td></td><td class="num">${m(P.optTotal)}</td><td></td><td></td></tr>` : ''}
   <tr class="grand"><td>Grand Total${P.optTotal ? ' (base + optional)' : ''}</td><td></td><td></td><td></td><td class="num">${m(P.grand)}</td><td></td><td></td></tr></table></div>
   ${Q.notes ? `<p>${esc(Q.notes)}</p>` : ''}
   <p><b>Exclusions:</b> Concrete by others. Placing, sales tax, and items not listed are excluded unless shown above.</p>
   <p><b>Escalation:</b> Prices are firm for 30 days from the quote date. After 30 days, unshipped tons escalate +$1.50/cwt per quarter. Tariffs, if any, are passed through.</p>
   ${Q.showCredit ? `<p class="muted" style="font-size:10px">${CREDIT}</p>` : ''}<p class="muted">Rebar-Fab · ${COMPANY.addr1}, ${COMPANY.addr2} · ${COMPANY.main} · ${COMPANY.email}</p></div>`;
  app.querySelectorAll('[data-q]').forEach(i => i.onchange = () => { Q[i.dataset.q] = i.value.trim(); touch(); rQuote(); });
  $('[data-qc]').onchange = e => { Q.showCredit = e.target.checked; touch(); rQuote(); };
  $('[data-qr]').onchange = e => { Q.showRefs = e.target.checked; touch(); rQuote(); };
  $('#pdf').onclick = () => window.print();
  $('#csv2').onclick = () => download(`rebarfab_quote_${slug()}.csv`, toCSV(), 'text/csv');
  const pdfName = () => `Rebar-Fab_Quote_${Q.no}_${slug()}.pdf`;
  $('#dlPdf').onclick = async () => { const b = await quotePDF(P); download(pdfName(), b, 'application/pdf'); };
  const sp = $('#sharePdf'); const probe = navigator.canShare && navigator.canShare({files:[new File(['x'], 'a.pdf', {type:'application/pdf'})]}); if (!probe) sp.textContent = 'Share PDF (download)';
  sp.onclick = async () => { const b = await quotePDF(P), f = new File([b], pdfName(), {type:'application/pdf'});
    try { if (navigator.canShare && navigator.canShare({files:[f]})) await navigator.share({title:`Rebar-Fab Quote ${Q.no}`, text:`Rebar-Fab Quote ${Q.no} - ${Q.project}`, files:[f]}); else download(pdfName(), b, 'application/pdf'); } catch (e) {} };
  $('#share').onclick = async () => { const text = quoteText(P);
    try { if (navigator.share) await navigator.share({title:'Rebar-Fab Quote ' + Q.no, text}); else location.href = mailtoHref(P); } catch (e) {} };
}

/* ---------- SAVED ---------- */
async function rSaved() { await put('quotes', Q); const all = (await getAll('quotes')).sort((a, b) => b.updated - a.updated);
  app.innerHTML = `<h2>Saved quotes</h2><button class="btn p" id="nq">+ New quote</button>${all.map(q => { const P = C.priceAny(q, S);
    return `<div class="card" data-id="${q.id}"><div class="lhead"><div><h3>${esc(q.project || '(no project)')}${q.id===Q.id?' · open':''}</h3><div class="muted">${esc(q.customer)} · ${esc(q.date)} · ${q.manual ? (q.mlines||[]).length + ' items (manual)' : q.lines.length + ' lines'} · ${C.money(P.grand)}</div></div></div>
    <button class="btn sm p" data-a="open">Open</button><button class="btn sm" data-a="dup">Duplicate</button><button class="btn sm d" data-a="del">Delete</button></div>`; }).join('')}`;
  $('#nq').onclick = () => { Q = newQuote(); touch(); go('takeoff'); };
  app.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { const id = b.closest('[data-id]').dataset.id, q = all.find(x => x.id === id);
    if (b.dataset.a === 'open') { Q = q; touch(); go('takeoff'); }
    if (b.dataset.a === 'dup') { const c = JSON.parse(JSON.stringify(q)); c.id = uid(); c.project = (c.project || '') + ' (copy)'; c.lines.forEach(l => l.id = uid()); (c.mlines||[]).forEach(l => l.id = uid()); c.no = (c.no || 'RF') + '-B';
      // copy photos too
      const ph = (await getAll('photos')).filter(p => p.quoteId === q.id); for (const p of ph) await put('photos', Object.assign({}, p, {id:uid(), quoteId:c.id}));
      c.updated = Date.now(); await put('quotes', c); rSaved(); }
    if (b.dataset.a === 'del' && confirm('Delete this quote and its photos?')) { await del('quotes', id); for (const p of (await getAll('photos')).filter(p => p.quoteId === id)) await del('photos', p.id);
      if (id === Q.id) { Q = newQuote(); touch(); } rSaved(); } });
}

/* ---------- SETTINGS ---------- */
async function sha(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('rf:' + t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
let unlocked = false;
function applyAccOv() { ACC.forEach(a => { a.sell = (S.accSell && S.accSell[a.id] !== undefined) ? S.accSell[a.id] : a.sellDefault; }); }
function saveS() { localStorage.setItem('rf_settings', JSON.stringify(S)); }
function rSettings() { const F = [['fab','Fabricated $/lb'],['straight','Straight $/lb'],['epoxy','Epoxy $/lb'],['wastePct','Waste %'],['markupPct','Markup %'],['truckPerLoad','Trucking $/load'],['tonsPerLoad','Tons per load'],['shopPerTon','Shop drawings $/T'],['lapDb','Lap (bar diameters)'],['hookDb','Hook extension (bar diameters)'],['maxBar','Max stock bar length (ft)']];
  const locked = !!S.pinHash && !unlocked, dis = locked ? 'disabled' : '';
  app.innerHTML = `<h2>Settings · Market rates</h2>
   <div class="card">${S.pinHash ? (locked ? `<div class="row"><b style="flex:1">🔒 Locked by admin PIN</b><input id="pinIn" type="password" inputmode="numeric" placeholder="PIN" style="width:120px"><button class="btn sm p" id="unlock">Unlock</button></div>` : `<div class="row"><b style="flex:1">🔓 Unlocked</b><button class="btn sm" id="lock">Lock</button><button class="btn sm d" id="rmPin">Remove PIN</button></div>`)
     : `<div class="row"><input id="pinNew" type="password" inputmode="numeric" placeholder="Set admin PIN (optional)" style="flex:1"><button class="btn sm" id="setPin">Set PIN</button></div>`}</div>
   <div class="card"><div class="grid">${F.map(([k, l]) => `<label>${l}<input data-s="${k}" inputmode="decimal" value="${S[k]}" ${dis}></label>`).join('')}</div>
   <label class="chk"><input type="checkbox" data-s="markupFreightShop" ${S.markupFreightShop?'checked':''} ${dis}>Apply markup to trucking and shop drawings</label>
   <button class="btn" id="reset" ${dis}>Reset to Rebar-Fab defaults</button><div class="muted">Stored on this device only. Weights: ASTM A615 ${Object.entries(C.WT).map(([b, w]) => '#'+b+' '+w).join(', ')} lb/LF.</div></div>
   <details class="card"><summary><b>Accessory prices (sell, each/unit)</b></summary>${ACC.map(a => { const ch = S.accSell && S.accSell[a.id] !== undefined;
     return `<label style="${ch?'background:#fff3c4;border-radius:8px;padding:4px':''}">${esc(a.item)} (${esc(a.unit)}) <span class="sub">cost ${C.money(a.cost)} · list sell ${a.sellDefault.toFixed(4)}</span><input data-acc="${a.id}" inputmode="decimal" value="${(+a.sell.toFixed(4))}" ${dis}></label>`; }).join('')}</details>
   <div class="card"><img src="logo.png" alt="Rebar-Fab" style="width:200px;max-width:60%"><h3>About</h3><div class="muted">${CREDIT}</div><div class="muted">Rebar-Fab Field Quote v1.1 · works offline after first load. Install: iPhone Safari → Share → Add to Home Screen; Android Chrome → menu → Install app.</div>`;
  app.querySelectorAll('[data-s]').forEach(i => i.onchange = () => { S[i.dataset.s] = i.type === 'checkbox' ? i.checked : (parseFloat(i.value) || 0); saveS(); });
  app.querySelectorAll('[data-acc]').forEach(i => i.onchange = () => { S.accSell ||= {}; const a = ACC.find(x => x.id == i.dataset.acc), v = parseFloat(i.value);
    if (!isFinite(v) || Math.abs(v - a.sellDefault) < 1e-9) delete S.accSell[a.id]; else S.accSell[a.id] = v; saveS(); applyAccOv(); rSettings(); });
  $('#reset').onclick = () => { if (!confirm('Reset all market rates and accessory prices to Rebar-Fab defaults?')) return; const ph = S.pinHash; Object.keys(S).forEach(k => delete S[k]); Object.assign(S, C.DEFAULTS); if (ph) S.pinHash = ph; saveS(); applyAccOv(); rSettings(); };
  const b = id => document.getElementById(id);
  if (b('setPin')) b('setPin').onclick = async () => { const v = b('pinNew').value.trim(); if (v.length < 4) return alert('PIN must be at least 4 digits.'); S.pinHash = await sha(v); saveS(); unlocked = false; rSettings(); };
  if (b('unlock')) b('unlock').onclick = async () => { if (await sha(b('pinIn').value.trim()) === S.pinHash) { unlocked = true; rSettings(); } else alert('Wrong PIN'); };
  if (b('lock')) b('lock').onclick = () => { unlocked = false; rSettings(); };
  if (b('rmPin')) b('rmPin').onclick = () => { delete S.pinHash; saveS(); rSettings(); };
}

/* ---------- nav ---------- */
const R = {takeoff:rTakeoff, photo:rPhoto, price:rPrice, quote:rQuote, saved:rSaved, settings:rSettings};
function go(t) { if (!R[t]) t = 'takeoff'; document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t); R[t](); window.scrollTo(0, 0); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
const net = () => { const n = $('#net'); n.textContent = navigator.onLine ? 'Online' : 'Offline'; n.classList.toggle('off', !navigator.onLine); };
addEventListener('online', net); addEventListener('offline', net); net();
const sp = document.getElementById('splash'); if (sp) setTimeout(() => sp.classList.add('gone'), 1200);
if ('serviceWorker' in navigator) { const had = !!navigator.serviceWorker.controller; navigator.serviceWorker.register('sw.js'); let done = false; navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !done) { done = true; location.reload(); } }); }
fetch('accessories.json').then(r => r.json()).then(a => { ACC = a; ACC.forEach(x => x.sellDefault = x.sell); applyAccOv(); }).finally(() => { touch(); go(location.hash.slice(1)); });
window.RF = { get Q() { return Q; }, set Q(v) { Q = v; touch(); }, S, go, put, getAll, PH, toCSV, fromCSV, importFile, quotePDF, mailtoHref, C };
