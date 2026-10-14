/* Rebar-Fab Field Quote - app UI */
'use strict';
const CREDIT = 'Designed by Joe Dane Lucero P.E.';
const C = RFCalc, $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => new Date().toLocaleDateString('en-CA');
const BARS = [3,4,5,6,7,8,9,10,11];
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
  trucking:{mode:'auto', manualBy:'total', total:'', loads:'', perLoad:S.truckPerLoad}, ov:{}, showCredit:false, photos:[], updated:Date.now() });
let Q = JSON.parse(localStorage.getItem('rf_current') || 'null') || newQuote();
let saveT; function touch() { Q.ov ||= {}; Q.updated = Date.now(); localStorage.setItem('rf_current', JSON.stringify(Q)); clearTimeout(saveT); saveT = setTimeout(() => put('quotes', Q), 400);
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
  custom:{name:'Custom line', f:[['mark','Mark'],['bar','Bar size',BAR],['count','Count'],['len','Length (ft)'],['hooks','Hooks per bar',HK],['fab','Fabricated (bent)','chk']], d:{mark:'',bar:5,count:10,len:20,hooks:0,fab:false}},
};
const newLine = (type, p) => ({ id:uid(), type, desc:EL[type].name, ref:'', epoxy:false, optional:false, fab:'auto', laps:true, p:Object.assign({}, EL[type].d, p||{}) });

/* ---------- render helpers ---------- */
function field(k, label, kind, val, dataAttr) {
  const a = `data-${dataAttr}="${k}"`;
  if (kind === BAR) return `<label>${label}<select ${a}>${BARS.map(b => `<option value="${b}" ${+val===b?'selected':''}>#${b}</option>`).join('')}</select></label>`;
  if (kind && kind.startsWith('sel:')) return `<label>${label}<select ${a}>${kind.slice(4).split(',').map(o => { const [v, t] = o.split('='); return `<option value="${v}" ${String(val)===v?'selected':''}>${t||v}</option>`; }).join('')}</select></label>`;
  if (kind === 'chk') return `<label class="chk"><input type="checkbox" ${a} ${val?'checked':''}>${label}</label>`;
  return `<label>${label}<input ${a} inputmode="decimal" value="${esc(val)}"></label>`;
}
function mathTable(t) {
  return `<table class="math"><tr><th>Mark</th><th>Math</th><th>Sticks 20'/40'</th></tr>${t.rows.map(r => `<tr><td>${esc(r.mark)}<div class="sub">#${r.bar} ${r.cls}</div></td>
   <td class="eq">${r.count} x ${r.len} ft = ${r.lf.toLocaleString()} LF x ${r.wt} lb/LF = ${r.lb.toLocaleString()} lb<div class="sub">${esc(r.note||r.calc||'')}</div></td><td>${r.s20} / ${r.s40}</td></tr>`).join('')}</table>
   <div class="tot">Line: ${t.lf.toLocaleString()} LF · ${t.lb.toLocaleString()} lb (fab ${t.fabLb.toLocaleString()} / straight ${t.straightLb.toLocaleString()}) · ${t.s20} x 20' · ${t.s40} x 40'</div>`;
}

/* ---------- TAKEOFF ---------- */
function rTakeoff() {
  let tl = 0, tf = 0;
  const cards = Q.lines.map((L, i) => { const t = C.takeoff(L, S); tl += t.lb; tf += t.fabLb;
    return `<div class="card" data-line="${L.id}"><div class="lhead"><h3>${i+1}. ${esc(EL[L.type].name)}</h3><button class="btn sm d" data-act="dl">Delete</button></div>
    <div class="grid"><label>Description<input data-l="desc" value="${esc(L.desc)}"></label><label>Plan sheet / page ref<input data-l="ref" value="${esc(L.ref)}" placeholder="e.g. S-201 p.14"></label></div>
    <div class="grid">${EL[L.type].f.map(([k, lab, kind]) => field(k, lab, kind, L.p[k], 'p')).join('')}</div>
    <div class="grid"><label>Class<select data-l="fab"><option value="auto" ${L.fab==='auto'?'selected':''}>Auto (bent = fabricated)</option><option value="fab" ${L.fab==='fab'?'selected':''}>All fabricated</option><option value="straight" ${L.fab==='straight'?'selected':''}>All straight</option></select></label>
    <div>${field('epoxy','Epoxy coated','chk',L.epoxy,'l')}${field('optional','Optional line','chk',L.optional,'l')}${field('laps','Carry laps (bars > '+S.maxBar+' ft)','chk',L.laps,'l')}</div></div>
    <div class="mt">${mathTable(t)}</div></div>`; }).join('');
  app.innerHTML = `<h2>Takeoff</h2><div class="card"><label>Add element<select id="addType">${Object.entries(EL).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select></label>
   <button class="btn p" id="addLine">+ Add line</button><button class="btn" id="imp">Import CSV/JSON</button><button class="btn" id="expCsv">Export CSV</button><button class="btn" id="expJson">Export JSON</button>
   <input type="file" id="impF" accept=".csv,.json,text/csv,application/json" hidden>
   <div class="muted">Laps ${S.lapDb} db · hooks ${S.hookDb} db · stock ${S.maxBar} ft (Settings). Rebar only; concrete by others.</div></div>
   ${cards || '<div class="card muted">No lines yet. Add an element, import a takeoff from the office, or measure on a Plan Photo.</div>'}
   <div class="card tot">Takeoff total: ${C.money(tl).slice(1)} lb · fab ${tf.toFixed(2)} lb · ${(tl/2000).toFixed(3)} T (before waste)</div>`;
  $('#addLine').onclick = () => { Q.lines.push(newLine($('#addType').value)); touch(); rTakeoff(); window.scrollTo(0, document.body.scrollHeight); };
  $('#imp').onclick = () => $('#impF').click(); $('#impF').onchange = e => importFile(e.target.files[0]);
  $('#expCsv').onclick = () => download(`rebarfab_takeoff_${slug()}.csv`, toCSV(), 'text/csv');
  $('#expJson').onclick = () => download(`rebarfab_takeoff_${slug()}.json`, JSON.stringify(exportObj(), null, 1), 'application/json');
  app.querySelectorAll('[data-line]').forEach(card => { const L = Q.lines.find(x => x.id === card.dataset.line);
    card.addEventListener('input', e => upd(e, L, card)); card.addEventListener('change', e => upd(e, L, card, true));
    card.querySelector('[data-act=dl]').onclick = () => { if (confirm('Delete this line?')) { Q.lines = Q.lines.filter(x => x !== L); touch(); rTakeoff(); } }; });
}
function upd(e, L, card, rerender) { const t = e.target, v = t.type === 'checkbox' ? t.checked : t.value;
  if (t.dataset.p) L.p[t.dataset.p] = v; else if (t.dataset.l) L[t.dataset.l] = v; else return;
  touch(); card.querySelector('.mt').innerHTML = mathTable(C.takeoff(L, S)); }

/* ---------- import / export ---------- */
const CSV_COLS = ['line_no','element','description','sheet_ref','epoxy','optional','class_override','carry_laps','mark','bar','count','length_ft','lf','lb_per_lf','lb','sticks_20','sticks_40','class','math','params_json','override_per_lb'];
const slug = () => (Q.project || 'quote').replace(/[^a-z0-9]+/gi, '_').slice(0, 40);
const csvCell = v => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
function toCSV() { const out = [CSV_COLS.join(',')];
  Q.lines.forEach((L, i) => C.takeoff(L, S).rows.forEach((r, j) => out.push([i+1, L.type, L.desc, L.ref, L.epoxy?1:0, L.optional?1:0, L.fab, L.laps?1:0, r.mark, r.bar, r.count, r.len, r.lf, r.wt, r.lb, r.s20, r.s40, r.cls,
    `${r.count} x ${r.len} = ${r.lf} LF x ${r.wt} = ${r.lb} lb`, j === 0 ? JSON.stringify(L.p) : '', j === 0 ? (L.ovPerLb || '') : ''].map(csvCell).join(','))));
  out.push(''); out.push(['#trucking', Q.trucking.mode, Q.trucking.manualBy, Q.trucking.total, Q.trucking.loads, Q.trucking.perLoad].map(csvCell).join(','));
  out.push(['#override', JSON.stringify(Q.ov || {})].map(csvCell).join(','));
  Q.acc.forEach(a => out.push(['#accessory', a.id, a.item, a.unit, a.qty, a.sell, a.optional?1:0].map(csvCell).join(',')));
  return out.join('\r\n'); }
function parseCSV(text) { const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"' && text[i+1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i+1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); } return rows; }
function fromCSV(text) { const rows = parseCSV(text).filter(r => r.some(c => c !== '')); const H = rows.shift().map(h => h.trim().toLowerCase()); const ix = k => H.indexOf(k);
  const lines = [], byNo = {}, acc = []; let trucking = null, ov = null;
  rows.forEach(r => { if (r[0] === '#trucking') { trucking = {mode:r[1]||'auto', manualBy:r[2]||'total', total:r[3], loads:r[4], perLoad:r[5]||S.truckPerLoad}; return; }
    if (r[0] === '#override') { try { ov = JSON.parse(r[1]); } catch (e) {} return; }
    if (r[0] === '#accessory') { const base = ACC.find(a => a.id == r[1]) || {}; acc.push({id:+r[1], item:r[2], unit:r[3], qty:+r[4], sell:+r[5], cost:base.cost||0, optional:r[6]==='1'}); return; }
    const g = k => ix(k) >= 0 ? r[ix(k)] : ''; const no = g('line_no') || String(lines.length + 1);
    if (byNo[no]) return; // computed rows after the first are regenerated from params
    const type = EL[g('element')] ? g('element') : 'custom'; let p = null; try { p = g('params_json') ? JSON.parse(g('params_json')) : null; } catch (e) {}
    if (!p) p = { mark:g('mark'), bar:+String(g('bar')).replace('#',''), count:+g('count'), len:+g('length_ft'), hooks:0, fab:/fab/i.test(g('class')) };
    const L = newLine(p.mark !== undefined && type === 'custom' ? 'custom' : type, p); L.desc = g('description') || L.desc; L.ref = g('sheet_ref'); L.epoxy = g('epoxy') === '1'; L.optional = g('optional') === '1';
    L.fab = g('class_override') || 'auto'; L.ovPerLb = g('override_per_lb') || ''; L.laps = g('carry_laps') !== '0'; byNo[no] = L; lines.push(L); });
  // a plain bar list (no params) gives one custom line per row
  return { lines, acc, trucking, ov }; }
function exportObj() { return { app:'Rebar-Fab Field Quote', schema:1, exported:new Date().toISOString(), settings:S, quote:Object.assign({}, Q, {photos:undefined}),
  takeoff:Q.lines.map(L => Object.assign({}, L, {computed:C.takeoff(L, S)})) }; }
async function importFile(f) { if (!f) return; const text = await f.text(); let got;
  try { if (/\.json$/i.test(f.name) || text.trim().startsWith('{')) { const o = JSON.parse(text); const q = o.quote || o; got = { lines:(q.lines || o.takeoff || []).map(L => Object.assign(newLine(L.type in EL ? L.type : 'custom'), L, {id:uid(), computed:undefined})), acc:q.acc || [], trucking:q.trucking, ov:q.ov, meta:q }; }
    else got = fromCSV(text); } catch (e) { alert('Could not read file: ' + e.message); return; }
  const replace = Q.lines.length ? confirm(`Import ${got.lines.length} line(s). OK = start a new quote with them, Cancel = add to this quote.`) : true;
  if (replace) { await put('quotes', Q); Q = newQuote(); if (got.meta) ['customer','project','date','rep','notes'].forEach(k => { if (got.meta[k]) Q[k] = got.meta[k]; }); }
  Q.lines.push(...got.lines); Q.acc.push(...(got.acc || [])); if (got.trucking) Q.trucking = Object.assign(Q.trucking, got.trucking); if (got.ov) Q.ov = Object.assign(Q.ov || {}, got.ov); touch(); rTakeoff(); }
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
function rPrice() { const P = C.priceQuote(Q, S), T = Q.trucking;
  const warn = P.lines.filter(l => l.belowCost), accW = P.acc.filter(a => a.sell < a.cost - 0.005);
  const slabs = Q.lines.filter(l => l.type === 'slab');
  app.innerHTML = `<h2>Price (internal)</h2>
  ${(warn.length || accW.length || P.s.markupPct <= 0) ? `<div class="note" style="background:#fde8e8;border-color:#e99">⚠ Sell at or below cost: ${P.s.markupPct <= 0 ? `quote markup is ${P.s.markupPct.toFixed(2)}%. ` : ''}${warn.map(l => esc(l.line.desc)).concat(accW.map(a => esc(a.a.item))).join(', ')}</div>` : ''}
  ${ovCard(P)}
  <div class="card"><h3>Trucking</h3><div class="row"><button class="btn ${T.mode==='auto'?'on':''}" data-tm="auto">Auto</button><button class="btn ${T.mode==='manual'?'on':''}" data-tm="manual">Manual</button></div>
   ${T.mode === 'manual' ? `<div class="row"><label class="chk"><input type="radio" name="mb" value="total" ${T.manualBy==='total'?'checked':''}>Total $</label><label class="chk"><input type="radio" name="mb" value="loads" ${T.manualBy==='loads'?'checked':''}>Loads x $/load</label></div>
     ${T.manualBy === 'total' ? `<label>Trucking total ($)<input data-t="total" inputmode="decimal" value="${esc(T.total)}"></label>` : `<div class="grid"><label>Loads<input data-t="loads" inputmode="decimal" value="${esc(T.loads)}"></label><label>$ per load<input data-t="perLoad" inputmode="decimal" value="${esc(T.perLoad)}"></label></div>`}` : ''}
   <div class="eq tot">${esc(P.trucking.math)} = ${C.money(P.trucking.amt)}</div><div class="muted">Base tons ${P.baseTons} (with ${S.wastePct}% waste). Allocated to base lines by tonnage; optional lines carry their own ROUNDUP(T/${S.tonsPerLoad}) loads.</div></div>
  <div class="card"><h3>Lines</h3><table class="math"><tr><th>Line</th><th>Math</th></tr>${P.lines.map((l, i) => `<tr><td>${i+1}. ${esc(l.line.desc)}${l.optional?' <b>(opt)</b>':''}<div class="sub">${l.lbW.toLocaleString()} lb · ${l.tons.toFixed(3)} T</div></td>
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
function rQuote() { const P = C.priceQuote(Q, S), m = C.money;
  const rowH = (l, i) => `<tr><td>${i}. ${esc(l.line.desc)}${l.line.epoxy?' (epoxy)':''}<div class="muted">${l.lbW.toLocaleString()} lb · ${l.tons.toFixed(2)} T${l.line.ref?' · Ref '+esc(l.line.ref):''}</div></td><td class="num">${m(l.material)}</td><td class="num">${m(l.trucking)}</td><td class="num">${m(l.shop)}</td><td class="num"><b>${m(l.total)}</b></td><td class="num">${m(l.perTon)}</td><td class="num">$${l.perLb.toFixed(4)}</td></tr>`;
  const accH = a => `<tr><td>${esc(a.a.item)}<div class="muted">${a.a.qty} ${esc(a.a.unit||'')}</div></td><td class="num">${m(a.sell)}</td><td></td><td></td><td class="num"><b>${m(a.sell)}</b></td><td></td><td></td></tr>`;
  const base = P.lines.filter(l => !l.optional), opt = P.lines.filter(l => l.optional);
  let n = 0;
  app.innerHTML = `<div class="noprint"><h2>Quote</h2><div class="card"><div class="grid">
    <label>Customer<input data-q="customer" value="${esc(Q.customer)}"></label><label>Project<input data-q="project" value="${esc(Q.project)}"></label>
    <label>Date<input type="date" data-q="date" value="${esc(Q.date)}"></label><label>Sales rep<input data-q="rep" value="${esc(Q.rep)}"></label></div>
    <label>Notes (customer copy)<textarea data-q="notes" rows="2">${esc(Q.notes)}</textarea></label>
    <label class="chk"><input type="checkbox" data-qc ${Q.showCredit?'checked':''}>Show designer credit on quote</label><button class="btn p" id="pdf">Print / PDF</button><button class="btn" id="share">Share</button><button class="btn" id="csv2">CSV</button></div></div>
  <div class="quote scr printme"><div class="qhead"><img src="logo.png" alt="Rebar-Fab"><div class="addr"><b>Rebar-Fab</b><br>${COMPANY.addr1}<br>${COMPANY.addr2}<br>Main ${COMPANY.main}<br>Joe direct ${COMPANY.direct}<br>${COMPANY.email}</div></div>
   <div class="grid" style="margin-bottom:8px"><div><b>Customer:</b> ${esc(Q.customer)}<br><b>Project:</b> ${esc(Q.project)}</div><div><b>Date:</b> ${esc(Q.date)}<br><b>Sales rep:</b> ${esc(Q.rep)}</div></div>
   <div class="qscroll"><table class="qt"><tr><th>Item</th><th>Material</th><th>Trucking</th><th>Shop Drawings</th><th>Total</th><th>$/T</th><th>$/lb</th></tr>
   ${base.map(l => rowH(l, ++n)).join('')}${P.acc.filter(a => !a.optional).map(accH).join('')}
   <tr class="base"><td>Base Total (${(P.baseLb/2000).toFixed(2)} T)</td><td class="num">${m(base.reduce((a,l)=>a+l.material,0)+P.acc.filter(a=>!a.optional).reduce((a,x)=>a+x.sell,0))}</td><td class="num">${m(base.length?base.reduce((a,l)=>a+l.trucking,0):P.trucking.amt)}</td><td class="num">${m(base.reduce((a,l)=>a+l.shop,0))}</td><td class="num">${m(P.baseTotal)}</td><td class="num">${P.baseLb?m(P.baseTotal/(P.baseLb/2000)):''}</td><td class="num">${P.baseLb?'$'+(P.baseTotal/P.baseLb).toFixed(4):''}</td></tr>
   ${(opt.length || P.acc.some(a => a.optional)) ? `<tr class="sect"><td colspan="7">Optional items (not included in base)</td></tr>${opt.map(l => rowH(l, ++n)).join('')}${P.acc.filter(a => a.optional).map(accH).join('')}
   <tr class="base"><td>Optional Total</td><td></td><td></td><td></td><td class="num">${m(P.optTotal)}</td><td></td><td></td></tr>` : ''}
   <tr class="grand"><td>Grand Total${P.optTotal ? ' (base + optional)' : ''}</td><td></td><td></td><td></td><td class="num">${m(P.grand)}</td><td></td><td></td></tr></table></div>
   ${Q.notes ? `<p>${esc(Q.notes)}</p>` : ''}
   <p><b>Exclusions:</b> Concrete by others. Placing, sales tax, and items not listed are excluded unless shown above.</p>
   <p><b>Escalation:</b> Prices are firm for 30 days from the quote date. After 30 days, unshipped tons escalate +$1.50/cwt per quarter. Tariffs, if any, are passed through.</p>
   ${Q.showCredit ? `<p class="muted" style="font-size:10px">${CREDIT}</p>` : ''}<p class="muted">Rebar-Fab · ${COMPANY.addr1}, ${COMPANY.addr2} · ${COMPANY.main} · ${COMPANY.email}</p></div>`;
  app.querySelectorAll('[data-q]').forEach(i => i.onchange = () => { Q[i.dataset.q] = i.value; touch(); rQuote(); });
  $('[data-qc]').onchange = e => { Q.showCredit = e.target.checked; touch(); rQuote(); };
  $('#pdf').onclick = () => window.print();
  $('#csv2').onclick = () => download(`rebarfab_takeoff_${slug()}.csv`, toCSV(), 'text/csv');
  $('#share').onclick = async () => { const text = `Rebar-Fab quote — ${Q.project}\nCustomer: ${Q.customer}\nDate: ${Q.date}\nBase Total: ${m(P.baseTotal)}${P.optTotal?`\nOptional: ${m(P.optTotal)}\nGrand Total: ${m(P.grand)}`:''}\nConcrete by others. Firm 30 days, then +$1.50/cwt per quarter on unshipped tons; tariffs passed through.\n${Q.rep} · Rebar-Fab · ${COMPANY.direct} · ${COMPANY.email}`;
    const file = new File([toCSV()], `rebarfab_takeoff_${slug()}.csv`, {type:'text/csv'});
    try { if (navigator.canShare && navigator.canShare({files:[file]})) await navigator.share({title:'Rebar-Fab Quote', text, files:[file]}); else if (navigator.share) await navigator.share({title:'Rebar-Fab Quote', text});
      else location.href = 'mailto:?subject=' + encodeURIComponent('Rebar-Fab Quote - ' + Q.project) + '&body=' + encodeURIComponent(text); } catch (e) {} };
}

/* ---------- SAVED ---------- */
async function rSaved() { await put('quotes', Q); const all = (await getAll('quotes')).sort((a, b) => b.updated - a.updated);
  app.innerHTML = `<h2>Saved quotes</h2><button class="btn p" id="nq">+ New quote</button>${all.map(q => { const P = C.priceQuote(q, S);
    return `<div class="card" data-id="${q.id}"><div class="lhead"><div><h3>${esc(q.project || '(no project)')}${q.id===Q.id?' · open':''}</h3><div class="muted">${esc(q.customer)} · ${esc(q.date)} · ${q.lines.length} lines · ${C.money(P.grand)}</div></div></div>
    <button class="btn sm p" data-a="open">Open</button><button class="btn sm" data-a="dup">Duplicate</button><button class="btn sm d" data-a="del">Delete</button></div>`; }).join('')}`;
  $('#nq').onclick = () => { Q = newQuote(); touch(); go('takeoff'); };
  app.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => { const id = b.closest('[data-id]').dataset.id, q = all.find(x => x.id === id);
    if (b.dataset.a === 'open') { Q = q; touch(); go('takeoff'); }
    if (b.dataset.a === 'dup') { const c = JSON.parse(JSON.stringify(q)); c.id = uid(); c.project = (c.project || '') + ' (copy)'; c.lines.forEach(l => l.id = uid());
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
   <div class="card"><img src="logo.png" alt="Rebar-Fab" style="width:200px;max-width:60%"><h3>About</h3><div class="muted">${CREDIT}</div><div class="muted">Rebar-Fab Field Quote v1 · works offline after first load. Install: iPhone Safari → Share → Add to Home Screen; Android Chrome → menu → Install app.</div>`;
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

/* ---------- PLAN PHOTO ---------- */
const PH = { photo:null, img:null, mode:'pan', pts:[], view:{s:1, x:0, y:0} };
const fmtFt = ft => { const f = Math.floor(ft + 1e-9), i = (ft - f) * 12; return `${f}'-${i.toFixed(1)}"`; };
function parseLen(s) { s = String(s).trim(); let m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*"?$/); if (m) return +m[1] + (+(m[2] || 0)) / 12;
  m = s.match(/^(\d+(?:\.\d+)?)\s*"$/); if (m) return +m[1] / 12; return parseFloat(s); }
async function rPhoto() { const photos = (await getAll('photos')).filter(p => p.quoteId === Q.id);
  if (PH.photo && PH.photo.quoteId !== Q.id) PH.photo = null;
  const p = PH.photo;
  app.innerHTML = `<h2>Plan Photo</h2><div class="note"><b>Field estimate only.</b> Photo measurements are approximate (lens distortion, angle, paper scale). Verify against the scaled plans before ordering.</div>
  <div class="card"><div class="row"><label class="btn p">📷 Camera<input type="file" accept="image/*" capture="environment" id="cam" hidden></label><label class="btn">Gallery<input type="file" accept="image/*" id="gal" hidden></label>
   <select id="phSel" style="flex:1;min-width:140px"><option value="">— photos on this quote (${photos.length}) —</option>${photos.map(x => `<option value="${x.id}" ${p&&p.id===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div>
  ${p ? `<div class="card"><div class="row"><b style="flex:1">${esc(p.name)}</b><span class="muted" id="scl">${p.ppf ? `Scale ${p.ppf.toFixed(2)} px/ft` : 'Not calibrated'}</span></div>
   <div class="row">${[['pan','Pan/zoom'],['cal','Calibrate'],['lin','Linear'],['area','Area'],['cnt','Count']].map(([k, l]) => `<button class="btn sm ${PH.mode===k?'on':''}" data-m="${k}">${l}</button>`).join('')}</div>
   <canvas id="cv"></canvas>
   <div class="row"><button class="btn sm" id="undo">Undo</button><button class="btn sm p" id="done">Finish</button><button class="btn sm" id="fit">Fit</button><button class="btn sm" id="ocr">Read callouts (OCR)</button><button class="btn sm d" id="phDel">Delete photo</button></div>
   <div class="muted" id="hint"></div><div id="ocrOut"></div></div>
   <div class="card"><h3>Measurements</h3>${(p.meas || []).map((m, i) => `<div class="row" style="border-bottom:1px solid #eee;padding:6px 0"><div style="flex:1"><b>M${i+1}</b> ${esc(measText(m))}</div>
     <select data-send="${i}" style="width:auto;flex:1"><option value="">Send to takeoff…</option>${sendTargets(m).map((t, j) => `<option value="${j}">${esc(t.label)}</option>`).join('')}</select><button class="btn sm d" data-mdel="${i}">X</button></div>`).join('') || '<div class="muted">None yet.</div>'}</div>` : ''}`;
  const addPhoto = async f => { if (!f) return; const data = await shrink(f); const name = (prompt('Photo name (sheet/page)', f.name.replace(/\.[^.]+$/, '')) || 'Plan photo');
    const rec = { id:uid(), quoteId:Q.id, name, data, ppf:null, meas:[], created:Date.now() }; await put('photos', rec); Q.photos.push(rec.id); touch(); PH.photo = rec; PH.img = null; PH.pts = []; rPhoto(); };
  $('#cam').onchange = e => addPhoto(e.target.files[0]); $('#gal').onchange = e => addPhoto(e.target.files[0]);
  $('#phSel').onchange = async e => { PH.photo = e.target.value ? await get1('photos', e.target.value) : null; PH.img = null; PH.pts = []; rPhoto(); };
  if (!p) return;
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { PH.mode = b.dataset.m; PH.pts = []; app.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('on', x === b)); hint(); draw(); });
  $('#undo').onclick = () => { if (PH.pts.length) PH.pts.pop(); else if (p.meas.length) { p.meas.pop(); savePh(); return rPhoto(); } draw(); };
  $('#done').onclick = finish; $('#fit').onclick = () => { fit(); draw(); };
  $('#phDel').onclick = async () => { if (!confirm('Delete photo?')) return; await del('photos', p.id); Q.photos = Q.photos.filter(x => x !== p.id); touch(); PH.photo = null; rPhoto(); };
  $('#ocr').onclick = runOCR;
  app.querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => { p.meas.splice(+b.dataset.mdel, 1); savePh(); rPhoto(); });
  app.querySelectorAll('[data-send]').forEach(s => s.onchange = () => { if (s.value === '') return; const m = p.meas[+s.dataset.send]; sendTargets(m)[+s.value].go(); });
  setupCanvas(); hint();
}
const savePh = () => put('photos', PH.photo);
function measText(m) { if (m.kind === 'lin') return `Linear ${m.val.toFixed(2)} LF (${fmtFt(m.val)}), ${m.pts.length - 1} seg`; if (m.kind === 'area') return `Area ${m.val.toFixed(1)} SF` + (m.L ? ` (~${m.L.toFixed(2)} x ${m.W.toFixed(2)} ft)` : ''); return `Count ${m.val}`; }
function refFor(m) { return `Photo: ${PH.photo.name} — ${measText(m)}`; }
function sendTargets(m) { const add = (type, p, desc) => () => { const L = newLine(type, p); L.ref = refFor(m); if (desc) L.desc = desc; Q.lines.push(L); touch(); alert(`Added ${EL[type].name}: ${measText(m)}`); go('takeoff'); };
  const T = [];
  if (m.kind === 'lin') { const v = +m.val.toFixed(2);
    T.push({label:`New footing / grade beam, LF ${v}`, go:add('footing', {LF:v})}, {label:`New wall, L ${v} ft`, go:add('wall', {L:v})}, {label:`New ductbank, LF ${v}`, go:add('ductbank', {LF:v})},
      {label:`New slab, L ${v} ft`, go:add('slab', {L:v})}, {label:`New custom line, length ${v} ft`, go:add('custom', {len:v, count:1})});
    if (m.pts.length === 3) { const a = C.polyLen(m.pts.slice(0, 2)) / PH.photo.ppf, b = C.polyLen(m.pts.slice(1)) / PH.photo.ppf; T.push({label:`New slab ${a.toFixed(2)} x ${b.toFixed(2)} ft (2 segments)`, go:add('slab', {L:+a.toFixed(2), W:+b.toFixed(2)})}); }
  } else if (m.kind === 'area') { T.push({label:`New slab ${m.L.toFixed(2)} x ${m.W.toFixed(2)} ft (${m.val.toFixed(0)} SF)`, go:add('slab', {L:+m.L.toFixed(2), W:+m.W.toFixed(2)})}); }
  else { T.push({label:`New pads, count ${m.val}`, go:add('pad', {count:m.val})}, {label:`New piers, count ${m.val}`, go:add('pier', {count:m.val})}); }
  Q.lines.forEach((L, i) => EL[L.type].f.filter(([k, , kind]) => !kind).forEach(([k, lab]) => { const v = m.kind === 'area' ? null : +m.val.toFixed(2); if (v === null) return;
    T.push({label:`Line ${i+1} ${L.desc}: set ${lab} = ${v}`, go:() => { L.p[k] = v; L.ref = (L.ref ? L.ref + '; ' : '') + refFor(m); touch(); go('takeoff'); }}); }));
  return T; }
function hint() { const h = $('#hint'); if (!h) return; h.textContent = ({pan:'Drag to pan, pinch (or wheel) to zoom.', cal:'Tap both ends of a known dimension, then Finish and enter its real length.', lin:'Tap points along the run; Finish to save. Needs calibration.', area:'Tap polygon corners; Finish to close. Needs calibration.', cnt:'Tap each item to count; Finish to save.'})[PH.mode]; }
function shrink(file) { return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const max = 2400, k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); URL.revokeObjectURL(img.src); };
  img.onerror = rej; img.src = URL.createObjectURL(file); }); }
let cv, ctx;
function fit() { if (!PH.img) return; const s = Math.min(cv.width / PH.img.width, cv.height / PH.img.height); PH.view = {s, x:(cv.width - PH.img.width * s) / 2, y:(cv.height - PH.img.height * s) / 2}; }
function setupCanvas() { cv = $('#cv'); ctx = cv.getContext('2d'); const dpr = window.devicePixelRatio || 1; const r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr;
  const start = () => { fit(); draw(); };
  if (PH.img && PH.img._id === PH.photo.id) start(); else { PH.img = new Image(); PH.img._id = PH.photo.id; PH.img.onload = start; PH.img.src = PH.photo.data; }
  const ptrs = new Map(); let downAt = null, moved = 0, pinch = null;
  const toImg = (cx, cy) => { const b = cv.getBoundingClientRect(), k = cv.width / b.width; return { x:((cx - b.left) * k - PH.view.x) / PH.view.s, y:((cy - b.top) * k - PH.view.y) / PH.view.s }; };
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); if (ptrs.size === 1) { downAt = {x:e.clientX, y:e.clientY}; moved = 0; } else pinch = null; };
  cv.onpointermove = e => { if (!ptrs.has(e.pointerId)) return; const prev = ptrs.get(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); const k = cv.width / cv.getBoundingClientRect().width;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = {x:(a.x + b.x) / 2, y:(a.y + b.y) / 2};
      if (pinch) { zoomAt(mid.x, mid.y, d / pinch.d); PH.view.x += (mid.x - pinch.mid.x) * k; PH.view.y += (mid.y - pinch.mid.y) * k; } pinch = {d, mid}; moved = 99; draw(); return; }
    moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
    if (moved > 8) { PH.view.x += (e.clientX - prev.x) * k; PH.view.y += (e.clientY - prev.y) * k; draw(); } };
  cv.onpointerup = cv.onpointercancel = e => { const wasSingle = ptrs.size === 1; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (wasSingle && moved <= 8 && PH.mode !== 'pan' && e.type === 'pointerup') { const pt = toImg(e.clientX, e.clientY);
      if (PH.mode === 'cal' && PH.pts.length >= 2) PH.pts = []; PH.pts.push(pt); draw(); } };
  cv.onwheel = e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.15 : 1 / 1.15); draw(); };
  function zoomAt(cx, cy, f) { const b = cv.getBoundingClientRect(), k = cv.width / b.width, px = (cx - b.left) * k, py = (cy - b.top) * k;
    PH.view.x = px - (px - PH.view.x) * f; PH.view.y = py - (py - PH.view.y) * f; PH.view.s *= f; }
}
const COL = {cal:'#e4572e', lin:'#00a6ed', area:'#7fb800', cnt:'#ffb400'};
function draw() { if (!ctx || !PH.img || !PH.img.complete) return; const v = PH.view, dpr = window.devicePixelRatio || 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#222'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.setTransform(v.s, 0, 0, v.s, v.x, v.y); ctx.drawImage(PH.img, 0, 0);
  const lw = 3 * dpr / v.s, fs = 15 * dpr / v.s;
  const shape = (pts, kind, label, closed) => { ctx.strokeStyle = ctx.fillStyle = COL[kind]; ctx.lineWidth = lw;
    if (kind === 'cnt') pts.forEach((p, i) => { ctx.beginPath(); ctx.arc(p.x, p.y, 9 * dpr / v.s, 0, 7); ctx.fill(); ctx.fillStyle = '#000'; ctx.font = `bold ${fs*0.8}px sans-serif`; ctx.fillText(i + 1, p.x - 4 * dpr / v.s, p.y + 5 * dpr / v.s); ctx.fillStyle = COL[kind]; });
    else { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); if (closed) { ctx.closePath(); ctx.globalAlpha = .2; ctx.fill(); ctx.globalAlpha = 1; } ctx.stroke();
      pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 5 * dpr / v.s, 0, 7); ctx.fill(); }); }
    if (label && pts.length) { const p = pts[pts.length - 1]; ctx.font = `bold ${fs}px sans-serif`; const w = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,.75)'; ctx.fillRect(p.x + 8 * dpr / v.s, p.y - fs, w + 8 * dpr / v.s, fs * 1.3); ctx.fillStyle = '#fff'; ctx.fillText(label, p.x + 12 * dpr / v.s, p.y); } };
  (PH.photo.meas || []).forEach((m, i) => shape(m.pts, m.kind, `M${i+1} ${m.kind==='lin'?m.val.toFixed(1)+' LF':m.kind==='area'?m.val.toFixed(0)+' SF':m.val+' ea'}`, m.kind === 'area'));
  if (PH.photo.cal) shape(PH.photo.cal.pts, 'cal', `scale ${fmtFt(PH.photo.cal.ft)}`);
  if (PH.pts.length) { const k = PH.mode, ppf = PH.photo.ppf; let lab = '';
    if (k === 'lin' && ppf) lab = (C.polyLen(PH.pts) / ppf).toFixed(2) + ' LF'; if (k === 'area' && ppf && PH.pts.length > 2) lab = (C.polyArea(PH.pts) / ppf / ppf).toFixed(1) + ' SF'; if (k === 'cnt') lab = PH.pts.length + ' ea';
    if (k === 'cal' && PH.pts.length === 2) lab = C.polyLen(PH.pts).toFixed(0) + ' px';
    shape(PH.pts, k, lab, k === 'area'); } }
function finish() { const p = PH.photo, k = PH.mode, pts = PH.pts;
  if (k === 'cal') { if (pts.length !== 2) return alert('Tap exactly 2 points.');
    const how = prompt('Real length of that dimension, e.g. 20\'-6" or 20.5 (ft).\nOr for a printed scale enter paper inches and scale like: 2in @ 1/8 (=1/8" per foot)');
    if (!how) return; let ft; const sm = how.match(/^\s*(\d+(?:\.\d+)?)\s*in\s*@\s*(\d+)\s*\/\s*(\d+)\s*$/i);
    if (sm) ft = (+sm[1]) / ((+sm[2]) / (+sm[3])); else ft = parseLen(how);
    if (!(ft > 0)) return alert('Could not read that length.');
    p.ppf = C.pxPerFt(pts[0], pts[1], ft); p.cal = {pts:pts.slice(), ft}; }
  else if (k === 'lin' || k === 'area') { if (!p.ppf) return alert('Calibrate first.'); if (pts.length < (k === 'lin' ? 2 : 3)) return alert('Need more points.');
    const m = {kind:k, pts:pts.slice()}; if (k === 'lin') m.val = C.polyLen(pts) / p.ppf; else { m.val = C.polyArea(pts) / p.ppf / p.ppf;
      if (pts.length === 4) { const s = i => C.polyLen([pts[i], pts[(i + 1) % 4]]) / p.ppf; m.L = (s(0) + s(2)) / 2; m.W = (s(1) + s(3)) / 2; }
      else { const w = parseLen(prompt(`Area ${m.val.toFixed(1)} SF. Enter slab width (ft) to get L = A / W`, '') || ''); m.W = w > 0 ? w : Math.sqrt(m.val); m.L = m.val / m.W; } }
    p.meas.push(m); }
  else if (k === 'cnt') { if (!pts.length) return; p.meas.push({kind:'cnt', pts:pts.slice(), val:pts.length}); }
  PH.pts = []; savePh(); rPhoto(); }
async function runOCR() { const out = $('#ocrOut'); out.innerHTML = '<div class="muted">Loading offline OCR (first run may take ~20 s)…</div>';
  try { if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'ocr/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('OCR files not available')); document.head.append(s); });
    const base = new URL('ocr/', location.href).href;
    const w = await Tesseract.createWorker('eng', 1, {workerPath:base + 'worker.min.js', corePath:base, langPath:base.replace(/\/$/, ''), workerBlobURL:false, gzip:true});
    // OCR the visible part of the canvas at its current zoom (zoom in on the callout first)
    const { data } = await w.recognize(cv); await w.terminate();
    const found = []; data.text.split('\n').forEach(t => { const c = C.parseCallout(t); if (c) found.push({t:t.trim(), c}); });
    out.innerHTML = `<div class="note">OCR text: <pre style="white-space:pre-wrap;font-size:12px">${esc(data.text.trim().slice(0, 600))}</pre>${found.length ? found.map((f, i) => `<div class="row"><b style="flex:1">#${f.c.bar} @ ${f.c.spacing}"${f.c.ew?' EW':''}</b><select data-ocr="${i}" style="width:auto"><option value="">Apply to line…</option>${Q.lines.map((L, j) => `<option value="${j}">${j+1}. ${esc(L.desc)}</option>`).join('')}</select></div>`).join('') : 'No bar callouts like #5 @ 12" EW found. Zoom in on the callout and try again.'}</div>`;
    out.querySelectorAll('[data-ocr]').forEach(s => s.onchange = () => { const L = Q.lines[+s.value], c = found[+s.dataset.ocr].c; if (!L) return; applyCallout(L, c); touch(); alert('Applied to line ' + (+s.value + 1)); });
  } catch (e) { out.innerHTML = `<div class="note">OCR unavailable: ${esc(e.message)}</div>`; } }
function applyCallout(L, c) { const p = L.p, sp = c.spacing;
  ({slab:() => { p.bar = c.bar; p.sX = sp; p.sY = sp; }, pad:() => { p.bar = c.bar; p.sp = sp; }, wall:() => { p.vBar = c.bar; p.sV = sp; if (c.ew) { p.hBar = c.bar; p.sH = sp; } },
    footing:() => { p.tieBar = c.bar; p.sTie = sp; }, ductbank:() => { p.tieBar = c.bar; p.sTie = sp; }, pier:() => { p.tieBar = c.bar; p.pitch = sp; }, custom:() => { p.bar = c.bar; }})[L.type]();
  L.ref = (L.ref ? L.ref + '; ' : '') + `OCR #${c.bar}@${sp}${c.ew?' EW':''}`; }

/* ---------- nav ---------- */
const R = {takeoff:rTakeoff, photo:rPhoto, price:rPrice, quote:rQuote, saved:rSaved, settings:rSettings};
function go(t) { if (!R[t]) t = 'takeoff'; document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); if (location.hash !== '#' + t) history.replaceState(null, '', '#' + t); R[t](); window.scrollTo(0, 0); }
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => go(b.dataset.tab));
const net = () => { const n = $('#net'); n.textContent = navigator.onLine ? 'Online' : 'Offline'; n.classList.toggle('off', !navigator.onLine); };
addEventListener('online', net); addEventListener('offline', net); net();
const sp = document.getElementById('splash'); if (sp) setTimeout(() => sp.classList.add('gone'), 1200);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
fetch('accessories.json').then(r => r.json()).then(a => { ACC = a; ACC.forEach(x => x.sellDefault = x.sell); applyAccOv(); }).finally(() => { touch(); go(location.hash.slice(1)); });
window.RF = { get Q() { return Q; }, set Q(v) { Q = v; touch(); }, S, go, put, getAll, PH, finish, toCSV, fromCSV, importFile };
