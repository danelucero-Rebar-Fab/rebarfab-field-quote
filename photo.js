/* Rebar-Fab Field Quote - Plan Set (multi-sheet photos / PDF pages), calibration, measuring, flatten, scan, OCR */
'use strict';
const MAXPX = 4096;            // stored long side (keeps measuring resolution, fits iOS canvas limits)
const PH = { sheets:[], cur:null, src:null, mode:'pan', tool:'cal', pts:[], pend:null, view:{s:1, x:0, y:0}, fitS:1, corners:null, box:null, drag:null, msg:'', worker:null, busy:'' };
const ptrs = new Map(); let pinch = null, cv = null, ctx = null, raf = 0;
const fmtFt = ft => { const neg = ft < 0; ft = Math.abs(ft); let f = Math.floor(ft + 1e-9), i = Math.round((ft - f) * 12 * 10) / 10; if (i >= 12) { f++; i = 0; } return `${neg?'-':''}${f}'-${i}"`; };
function parseLen(s) { s = String(s || '').trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"'); let m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*-?\s*(\d+(?:\.\d+)?)?\s*"?$/); if (m) return +m[1] + (+(m[2] || 0)) / 12;
  m = s.match(/^(\d+(?:\.\d+)?)\s*"$/); if (m) return +m[1] / 12; const x = parseFloat(s); return isFinite(x) ? x : NaN; }
const canvasBlob = (c, type = 'image/jpeg', q = 0.9) => new Promise(r => c.toBlob(r, type, q));
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function fitTo(img, w, h) { const k = Math.min(1, MAXPX / Math.max(w, h)); const c = mkCanvas(Math.round(w * k), Math.round(h * k)); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height); return c; }
async function decodeImage(file) { // EXIF orientation applied by createImageBitmap/from-image or by <img> (Safari 13.1+/Chrome 81+)
  try { const bm = await createImageBitmap(file, {imageOrientation:'from-image'}); const c = fitTo(bm, bm.width, bm.height); bm.close && bm.close(); return c; } catch (e) {}
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { res(fitTo(img, img.naturalWidth, img.naturalHeight)); URL.revokeObjectURL(img.src); };
    img.onerror = () => rej(new Error('This image format could not be read (HEIC?). On iPhone use "Choose photos" (Safari converts to JPEG) or set Settings > Camera > Formats > Most Compatible.')); img.src = URL.createObjectURL(file); }); }
async function pdfPages(file, onPage) { await loadScript('lib/pdf.min.js'); pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise; const N = Math.min(pdf.numPages, 40);
  for (let i = 1; i <= N; i++) { const pg = await pdf.getPage(i), v1 = pg.getViewport({scale:1}), k = MAXPX / Math.max(v1.width, v1.height), vp = pg.getViewport({scale:k});
    const c = mkCanvas(Math.round(vp.width), Math.round(vp.height)), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await pg.render({canvasContext:g, viewport:vp}).promise; await onPage(c, i, pdf.numPages); } }
async function addSheet(canvas, name, kind) { const blob = await canvasBlob(canvas), t = mkCanvas(1, 1), k = 140 / Math.max(canvas.width, canvas.height);
  t.width = Math.round(canvas.width * k); t.height = Math.round(canvas.height * k); t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  const rec = { id:uid(), quoteId:Q.id, name, nameAuto:true, kind, blob, orig:blob, w:canvas.width, h:canvas.height, thumb:t.toDataURL('image/jpeg', 0.7), ppf:null, cal:null, meas:[], ocr:[], enh:false, flat:false, created:Date.now() };
  await put('photos', rec); if (!Q.photos.includes(rec.id)) Q.photos.push(rec.id); touch(); return rec; }
async function addFiles(files) { const list = [...files]; if (!list.length) return; let last = null, i = 0;
  for (const f of list) { i++; PH.busy = `Adding ${i}/${list.length}: ${f.name}`; status();
    try { if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) await pdfPages(f, async (c, p, n) => { PH.busy = `PDF ${f.name}: page ${p}/${n}`; status(); last = await addSheet(c, `${f.name.replace(/\.pdf$/i, '')} p.${p}`, 'pdf'); });
      else last = await addSheet(await decodeImage(f), f.name.replace(/\.[^.]+$/, '') || 'Plan photo', 'photo'); }
    catch (e) { alert(e.message || String(e)); } }
  PH.busy = ''; if (last) await openSheet(last.id); else rPhoto();
  titleBlockAll(); }
async function loadSheets() { const all = (await getAll('photos')).filter(p => p.quoteId === Q.id).sort((a, b) => a.created - b.created);
  for (const r of all) if (!r.blob && r.data) { r.blob = r.orig = await (await fetch(r.data)).blob(); delete r.data; r.meas ||= []; r.ocr ||= []; await put('photos', r); } // v1.0 migrate
  PH.sheets = all; return all; }
async function openSheet(id) { const r = PH.sheets.find(x => x.id === id) || await get1('photos', id); if (!r) return; PH.cur = r; PH.pts = []; PH.box = null; PH.corners = null; PH.src = null;
  const bm = await createImageBitmap(r.blob); const c = mkCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); PH.src = c; await rPhoto(); }
const savePh = () => { const r = PH.cur; const i = PH.sheets.findIndex(x => x.id === r.id); if (i >= 0) PH.sheets[i] = r; return put('photos', r); };

/* ---------- UI ---------- */
const TOOLS = [['cal','Calibrate'],['lin','Length'],['area','Area'],['cnt','Count'],['ocr','OCR box'],['flat','Flatten']];
function stepText() { const r = PH.cur, n = PH.pts.length; if (!r) return '';
  switch (PH.tool) {
    case 'cal': return n === 0 ? 'Step 1: tap the START of a known dimension.' : n === 1 ? 'Step 2: tap the END of that dimension.' : 'Step 3: type its real length below and press Set scale.';
    case 'lin': return !r.ppf ? 'Calibrate first (Calibrate tool or Manual scale).' : n === 0 ? 'Tap the start of the run.' : `Tap the next point. Running total ${(C.polyLen(PH.pts) / r.ppf).toFixed(2)} LF. Press Save when done.`;
    case 'area': return !r.ppf ? 'Calibrate first.' : n < 3 ? `Tap the corners (${n} so far, need 3+).` : `Area ${(C.polyArea(PH.pts) / r.ppf ** 2).toFixed(1)} SF. Tap more corners or press Save.`;
    case 'cnt': return n === 0 ? 'Tap each item to count it.' : `${n} counted. Press Save when done.`;
    case 'ocr': return PH.box ? 'Press Read box to OCR the selected area.' : 'Drag a box around a callout or dimension, then press Read box.';
    case 'flat': return 'Drag the 4 corner handles to the sheet corners (or tap near a corner to move it there), then press Apply flatten.';
  } }
function status() { const s = document.getElementById('step'); if (s) s.textContent = PH.busy || stepText(); const c = document.getElementById('calForm'); if (c) c.hidden = !(PH.tool === 'cal' && PH.pts.length === 2);
  const sv = document.getElementById('saveM'); if (sv) sv.hidden = !['lin','area','cnt'].includes(PH.tool); const ob = document.getElementById('ocrRun'); if (ob) ob.hidden = PH.tool !== 'ocr';
  const fa = document.getElementById('flatGo'); if (fa) fa.hidden = PH.tool !== 'flat'; }
async function rPhoto() { if (!PH.cur || PH.cur.quoteId !== Q.id) { PH.cur = null; PH.src = null; }
  const sheets = await loadSheets(); if (PH.cur) PH.cur = sheets.find(s => s.id === PH.cur.id) || PH.cur;
  if (!PH.cur && sheets.length) return openSheet(sheets[0].id);
  const r = PH.cur;
  app.innerHTML = `<h2>Plan Set</h2><div class="note"><b>Field estimate only.</b> Photo/PDF measurements are approximate (camera angle, lens, print scale). Verify against the scaled plans before ordering.</div>
  <div class="card"><div class="row"><label class="btn p">📷 Take photo<input type="file" accept="image/*" capture="environment" id="cam" hidden></label>
   <label class="btn">🖼 Choose photos / PDF<input type="file" accept="image/*,application/pdf,.pdf" multiple id="gal" hidden></label></div>
   <div class="strip">${sheets.map((s, i) => `<button class="sheet ${r && r.id===s.id?'on':''}" data-sheet="${s.id}"><img src="${s.thumb||''}" alt=""><span>${esc(s.name)}</span><small>${s.ppf?'scaled':'no scale'} · ${(s.meas||[]).length} m</small></button>`).join('') || '<div class="muted">No sheets yet. Take photos or choose photos / PDF pages; each becomes a sheet in this quote\'s plan set.</div>'}</div></div>
  ${r ? `<div class="card"><div class="grid"><label>Sheet name / number<input id="shName" value="${esc(r.name)}"></label><div><div class="muted">${r.w} x ${r.h} px${r.flat?' · flattened':''}${r.enh?' · scan B&W':''}</div><div class="tot" id="scl">${r.ppf ? `Scale ${r.ppf.toFixed(2)} px/ft${r.cal&&r.cal.manual?` (${esc(r.cal.manual)})`:''}` : 'Not calibrated'}</div></div></div>
   <div class="seg"><button class="btn ${PH.mode==='pan'?'on':''}" data-mode="pan">✋ Pan / Zoom</button><button class="btn ${PH.mode==='place'?'on':''}" data-mode="place">📍 Place points</button></div>
   <div class="row">${TOOLS.map(([k, l]) => `<button class="btn sm ${PH.tool===k?'on':''}" data-tool="${k}">${l}</button>`).join('')}</div>
   <div id="step" class="step"></div>
   <canvas id="cv"></canvas>
   <div class="row"><button class="btn sm" id="undo">↶ Undo</button><button class="btn sm" id="clr">Clear points</button><button class="btn sm" id="fit">Fit</button><button class="btn sm p" id="saveM">Save measurement</button><button class="btn sm p" id="ocrRun">Read box (OCR)</button><button class="btn sm p" id="flatGo">Apply flatten</button></div>
   <div id="calForm" class="note" hidden><label>Real length of that dimension (e.g. 20'-6" or 20.5)<input id="calLen" inputmode="text" placeholder="20'-0&quot;"></label><button class="btn p" id="calSet">Set scale</button></div>
   <details class="card"><summary><b>Manual scale (type it)</b></summary><div class="grid"><label>Printed scale<input id="mScale" placeholder='1/8"=1&apos;-0"' value="${esc((r.cal&&r.cal.manual)||'')}"></label><label>Sheet printed width (in), image cropped to sheet edges<input id="mWidth" inputmode="decimal" placeholder="36" value="${esc((r.cal&&r.cal.width)||'')}"></label></div>
     <button class="btn" id="mSet">Set scale</button><div class="muted">Flatten to the sheet edges first. Example: ARCH D = 36" wide, 1/8"=1'-0" → 288 ft across the image.</div></details>
   <div class="row"><button class="btn sm" id="scan">${r.enh?'Scan B&W ✓':'Scan B&W'}</button><button class="btn sm" id="tb">Read title block</button><button class="btn sm" id="reset">Reset original</button><button class="btn sm d" id="phDel">Delete sheet</button></div>
   <div id="ocrOut"></div></div>
  <div class="card"><h3>Measurements on ${esc(r.name)}</h3>${(r.meas || []).map((m, i) => `<div class="mrow"><div><b>M${i+1}</b> ${esc(measText(m))}</div>
     <select data-send="${i}"><option value="">Send to takeoff…</option>${sendTargets(m, r).map((t, j) => `<option value="${j}">${esc(t.label)}</option>`).join('')}</select><button class="btn sm d" data-mdel="${i}">X</button></div>`).join('') || '<div class="muted">None yet.</div>'}
   ${(r.ocr || []).length ? `<h3 style="margin-top:8px">OCR callouts</h3>${r.ocr.map((o, i) => suggHTML(o, i)).join('')}` : ''}</div>` : ''}`;
  document.getElementById('cam').onchange = e => addFiles(e.target.files); document.getElementById('gal').onchange = e => addFiles(e.target.files);
  app.querySelectorAll('[data-sheet]').forEach(b => b.onclick = () => openSheet(b.dataset.sheet));
  if (!r) return;
  const B = id => document.getElementById(id);
  B('shName').onchange = e => { r.name = e.target.value.trim() || r.name; r.nameAuto = false; savePh(); Q.lines.forEach(L => { if (L.src && L.src.sheetId === r.id) L.src.sheet = r.name; }); touch(); rPhoto(); };
  app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { PH.mode = b.dataset.mode; PH.pend = null; app.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x === b)); status(); });
  app.querySelectorAll('[data-tool]').forEach(b => b.onclick = () => { PH.tool = b.dataset.tool; PH.pts = []; PH.box = null; if (PH.tool !== 'flat') PH.corners = null; else initCorners(); PH.mode = 'place';
    app.querySelectorAll('[data-tool]').forEach(x => x.classList.toggle('on', x === b)); app.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === 'place')); status(); draw(); });
  B('undo').onclick = () => { if (PH.pts.length) PH.pts.pop(); else if (PH.box) PH.box = null; else if (r.meas.length && confirm('Undo the last saved measurement?')) { r.meas.pop(); savePh(); return rPhoto(); } status(); draw(); };
  B('clr').onclick = () => { PH.pts = []; PH.box = null; status(); draw(); };
  B('fit').onclick = () => { fit(); draw(); }; B('saveM').onclick = saveMeasure; B('ocrRun').onclick = () => ocrBox(); B('flatGo').onclick = applyFlatten;
  B('calSet').onclick = () => { const ft = parseLen(B('calLen').value); if (!(ft > 0) || PH.pts.length !== 2) return alert('Enter a length like 20\'-6" or 20.5');
    r.ppf = C.pxPerFt(PH.pts[0], PH.pts[1], ft); r.cal = {pts:PH.pts.slice(), ft}; PH.pts = []; PH.tool = 'lin'; savePh(); rPhoto(); };
  B('mSet').onclick = () => { const ppf = C.ppfFromScale(B('mScale').value, parseFloat(B('mWidth').value), r.w); if (!ppf) return alert('Use a scale like 1/8"=1\'-0" or 1"=20\' and the sheet width in inches.');
    r.ppf = ppf; r.cal = {manual:B('mScale').value.trim(), width:parseFloat(B('mWidth').value)}; savePh(); rPhoto(); };
  B('scan').onclick = () => enhance(!r.enh); B('reset').onclick = resetOriginal; B('tb').onclick = () => titleBlock(r, true);
  B('phDel').onclick = async () => { if (!confirm(`Delete sheet ${r.name}?`)) return; await del('photos', r.id); Q.photos = Q.photos.filter(x => x !== r.id); touch(); PH.cur = null; rPhoto(); };
  app.querySelectorAll('[data-mdel]').forEach(b => b.onclick = () => { r.meas.splice(+b.dataset.mdel, 1); savePh(); rPhoto(); });
  app.querySelectorAll('[data-send]').forEach(s => s.onchange = () => { if (s.value === '') return; sendTargets(r.meas[+s.dataset.send], r)[+s.value].go(); });
  bindSugg(r); setupCanvas(); status();
}
function measText(m) { if (m.kind === 'lin') return `Length ${m.val.toFixed(2)} LF (${fmtFt(m.val)}), ${m.pts.length - 1} seg`; if (m.kind === 'area') return `Area ${m.val.toFixed(1)} SF` + (m.L ? ` (~${m.L.toFixed(2)} x ${m.W.toFixed(2)} ft)` : ''); return `Count ${m.val}`; }
const srcOf = r => ({sheetId:r.id, sheet:r.name, kind:r.kind});
function addLineFrom(r, type, p, ref, desc) { const L = newLine(type, p); L.ref = ref; L.src = srcOf(r); if (desc) L.desc = desc; Q.lines.push(L); touch(); return L; }
function sendTargets(m, r) { const ref = `${r.name} — ${measText(m)}`; const add = (type, p) => () => { addLineFrom(r, type, p, ref); alert(`Added ${EL[type].name} from ${r.name}: ${measText(m)}`); go('takeoff'); };
  const T = [];
  if (m.kind === 'lin') { const v = +m.val.toFixed(2);
    T.push({label:`New footing / grade beam, LF ${v}`, go:add('footing', {LF:v})}, {label:`New wall, L ${v} ft`, go:add('wall', {L:v})}, {label:`New ductbank, LF ${v}`, go:add('ductbank', {LF:v})}, {label:`New slab, L ${v} ft`, go:add('slab', {L:v})}, {label:`New custom line, length ${v} ft`, go:add('custom', {len:v, count:1})});
    if (m.pts.length === 3 && r.ppf) { const a = C.polyLen(m.pts.slice(0, 2)) / r.ppf, b = C.polyLen(m.pts.slice(1)) / r.ppf; T.push({label:`New slab ${a.toFixed(2)} x ${b.toFixed(2)} ft (2 segments)`, go:add('slab', {L:+a.toFixed(2), W:+b.toFixed(2)})}); }
  } else if (m.kind === 'area') T.push({label:`New slab ${m.L.toFixed(2)} x ${m.W.toFixed(2)} ft (${m.val.toFixed(0)} SF)`, go:add('slab', {L:+m.L.toFixed(2), W:+m.W.toFixed(2)})});
  else T.push({label:`New pads, count ${m.val}`, go:add('pad', {count:m.val})}, {label:`New piers, count ${m.val}`, go:add('pier', {count:m.val})});
  if (m.kind !== 'area') Q.lines.forEach((L, i) => (EL[L.type].f || []).filter(([k, , kind]) => !kind).forEach(([k, lab]) => { const v = +m.val.toFixed(2);
    T.push({label:`Line ${i+1} ${L.desc}: set ${lab} = ${v}`, go:() => { L.p[k] = v; L.ref = (L.ref ? L.ref + '; ' : '') + ref; L.src ||= srcOf(r); touch(); go('takeoff'); }}); }));
  return T; }
function saveMeasure() { const r = PH.cur, k = PH.tool, pts = PH.pts;
  if (k !== 'cnt' && !r.ppf) return alert('Calibrate this sheet first.');
  if (k === 'lin' && pts.length < 2) return alert('Tap at least 2 points.'); if (k === 'area' && pts.length < 3) return alert('Tap at least 3 corners.'); if (k === 'cnt' && !pts.length) return;
  const m = {kind:k, pts:pts.slice()};
  if (k === 'lin') m.val = C.polyLen(pts) / r.ppf;
  else if (k === 'area') { m.val = C.polyArea(pts) / r.ppf ** 2; if (pts.length === 4) { const s = i => C.polyLen([pts[i], pts[(i + 1) % 4]]) / r.ppf; m.L = (s(0) + s(2)) / 2; m.W = (s(1) + s(3)) / 2; } else { m.L = m.W = Math.sqrt(m.val); } }
  else m.val = pts.length;
  r.meas.push(m); PH.pts = []; savePh(); rPhoto(); }

/* ---------- canvas, gestures ---------- */
function fit() { if (!PH.src || !cv) return; const s = Math.min(cv.width / PH.src.width, cv.height / PH.src.height); PH.fitS = s; PH.view = {s, x:(cv.width - PH.src.width * s) / 2, y:(cv.height - PH.src.height * s) / 2}; }
const dpr = () => window.devicePixelRatio || 1;
function toCanvas(e) { const b = cv.getBoundingClientRect(); return {x:(e.clientX - b.left) * cv.width / b.width, y:(e.clientY - b.top) * cv.height / b.height}; }
const toImg = c => ({x:(c.x - PH.view.x) / PH.view.s, y:(c.y - PH.view.y) / PH.view.s});
function zoomAt(c, f) { const s0 = PH.view.s, s1 = Math.max(PH.fitS * 0.5, Math.min(PH.fitS * 8, s0 * f)), k = s1 / s0; PH.view.x = c.x - (c.x - PH.view.x) * k; PH.view.y = c.y - (c.y - PH.view.y) * k; PH.view.s = s1; }
function setupCanvas() { cv = document.getElementById('cv'); if (!cv) return; ctx = cv.getContext('2d');
  const size = () => { const b = cv.getBoundingClientRect(); const w = Math.round(b.width * dpr()), h = Math.round(b.height * dpr()); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; fit(); } };
  size(); fit(); new ResizeObserver(() => { size(); draw(); }).observe(cv);
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onCancel);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(toCanvas(e), e.deltaY < 0 ? 1.2 : 1 / 1.2); draw(); }, {passive:false});
  cv.addEventListener('contextmenu', e => e.preventDefault()); draw(); }
function onDown(e) { e.preventDefault(); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, toCanvas(e));
  if (ptrs.size === 2) { PH.pend = null; PH.drag = null; const [a, b] = [...ptrs.values()]; pinch = {d:Math.hypot(a.x - b.x, a.y - b.y), mid:{x:(a.x + b.x) / 2, y:(a.y + b.y) / 2}}; draw(); return; }
  if (ptrs.size > 2) return; const c = toCanvas(e), p = toImg(c);
  if (PH.mode === 'pan') { PH.drag = {kind:'pan', last:c}; return; }
  if (PH.tool === 'flat') { if (!PH.corners) initCorners(); let bi = 0, bd = 1e18; PH.corners.forEach((q, i) => { const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d < bd) { bd = d; bi = i; } }); PH.corners[bi] = p; PH.drag = {kind:'corner', i:bi}; PH.pend = p; draw(); return; }
  if (PH.tool === 'ocr') { PH.box = {a:p, b:p}; PH.drag = {kind:'box'}; draw(); return; }
  PH.pend = p; PH.drag = {kind:'point'}; draw(); }
function onMove(e) { if (!ptrs.has(e.pointerId)) return; const c = toCanvas(e); ptrs.set(e.pointerId, c);
  if (ptrs.size === 2 && pinch) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mid = {x:(a.x + b.x) / 2, y:(a.y + b.y) / 2};
    PH.view.x += mid.x - pinch.mid.x; PH.view.y += mid.y - pinch.mid.y; zoomAt(mid, d / pinch.d); pinch = {d, mid}; draw(); return; }
  const D = PH.drag; if (!D) return; const p = toImg(c);
  if (D.kind === 'pan') { PH.view.x += c.x - D.last.x; PH.view.y += c.y - D.last.y; D.last = c; }
  else if (D.kind === 'corner') { PH.corners[D.i] = p; PH.pend = p; }
  else if (D.kind === 'box') PH.box.b = p; else if (D.kind === 'point') PH.pend = p;
  draw(); }
function onUp(e) { const wasPinch = !!pinch; ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (wasPinch) { PH.drag = null; PH.pend = null; draw(); return; }
  if (ptrs.size) return; const D = PH.drag; PH.drag = null;
  if (D && D.kind === 'point' && PH.pend) { if (PH.tool === 'cal' && PH.pts.length >= 2) PH.pts = []; PH.pts.push(PH.pend); if (navigator.vibrate) navigator.vibrate(10); }
  if (D && D.kind === 'box' && PH.box && Math.abs(PH.box.a.x - PH.box.b.x) * PH.view.s < 10) PH.box = null;
  PH.pend = null; status(); draw(); }
function onCancel(e) { ptrs.delete(e.pointerId); pinch = null; PH.drag = null; PH.pend = null; draw(); }
document.addEventListener('gesturestart', e => { if (e.target && e.target.id === 'cv') e.preventDefault(); });
function initCorners() { const r = PH.src; if (!r) return; const w = r.width, h = r.height, m = 0.06; PH.corners = [{x:w*m, y:h*m}, {x:w*(1-m), y:h*m}, {x:w*(1-m), y:h*(1-m)}, {x:w*m, y:h*(1-m)}]; }
const COL = {cal:'#e4572e', lin:'#00a6ed', area:'#7fb800', cnt:'#ffb400', ocr:'#d61f69', flat:'#ff00aa'};
function draw() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; paint(); }); }
function paint() { if (!ctx || !PH.src) return; const v = PH.view, D = dpr(), r = PH.cur;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#2b2b2b'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(v.s, 0, 0, v.s, v.x, v.y); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(PH.src, 0, 0);
  const u = D / v.s, lw = 2.5 * u, fs = 14 * u;
  const tag = (p, text, col) => { ctx.font = `bold ${fs}px -apple-system,sans-serif`; const w = ctx.measureText(text).width; ctx.fillStyle = 'rgba(0,0,0,.78)'; ctx.fillRect(p.x + 9 * u, p.y - fs * 1.05, w + 8 * u, fs * 1.35); ctx.fillStyle = col || '#fff'; ctx.fillText(text, p.x + 13 * u, p.y); };
  const dot = (p, col, rad = 6) => { ctx.beginPath(); ctx.arc(p.x, p.y, rad * u, 0, 7); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 1.5 * u; ctx.strokeStyle = '#fff'; ctx.stroke(); };
  const path = (pts, col, closed) => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); if (closed) { ctx.closePath(); ctx.globalAlpha = .18; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1; } ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); };
  const labelsLin = (pts, col, ppf) => { let s = 0; pts.forEach((p, i) => { if (i) s += Math.hypot(p.x - pts[i-1].x, p.y - pts[i-1].y); dot(p, col); if (i) tag(p, ppf ? `${(s / ppf).toFixed(2)} LF` : `${s.toFixed(0)} px`); }); };
  (r.meas || []).forEach((m, i) => { const col = COL[m.kind];
    if (m.kind === 'cnt') m.pts.forEach((p, j) => { dot(p, col, 9); ctx.fillStyle = '#000'; ctx.font = `bold ${fs * .8}px sans-serif`; ctx.fillText(j + 1, p.x - 4 * u, p.y + 5 * u); });
    else { path(m.pts, col, m.kind === 'area'); m.pts.forEach(p => dot(p, col, 4)); }
    tag(m.pts[m.pts.length - 1], `M${i+1} ${m.kind==='lin'?m.val.toFixed(2)+' LF':m.kind==='area'?m.val.toFixed(0)+' SF':m.val+' ea'}`); });
  if (r.cal && r.cal.pts) { path(r.cal.pts, COL.cal); r.cal.pts.forEach(p => dot(p, COL.cal, 4)); tag(r.cal.pts[1], `scale ${fmtFt(r.cal.ft)}`); }
  const pts = PH.pend && PH.drag && PH.drag.kind === 'point' ? PH.pts.concat([PH.pend]) : PH.pts, k = PH.tool, col = COL[k];
  if (pts.length) { if (k === 'cnt') pts.forEach((p, j) => { dot(p, col, 9); tag(p, String(j + 1)); });
    else if (k === 'area') { path(pts, col, true); pts.forEach(p => dot(p, col)); if (pts.length > 2 && r.ppf) tag(pts[pts.length - 1], `${(C.polyArea(pts) / r.ppf ** 2).toFixed(1)} SF`); }
    else if (k === 'cal' || k === 'lin') { path(pts, col); labelsLin(pts, col, k === 'lin' ? r.ppf : null); if (pts.length === 1) dot(pts[0], col); } }
  if (PH.box) { const {a, b} = PH.box; ctx.setLineDash([8 * u, 6 * u]); ctx.strokeStyle = COL.ocr; ctx.lineWidth = lw; ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(a.x - b.x), Math.abs(a.y - b.y)); ctx.setLineDash([]); }
  if (k === 'flat' && PH.corners) { path(PH.corners, COL.flat, true); PH.corners.forEach((p, i) => { dot(p, COL.flat, 13); ctx.fillStyle = '#fff'; ctx.font = `bold ${fs}px sans-serif`; ctx.fillText(i + 1, p.x - 4 * u, p.y + 5 * u); }); }
  // loupe while placing
  if (PH.pend && PH.drag) { const pc = {x:PH.pend.x * v.s + v.x, y:PH.pend.y * v.s + v.y}, R = 62 * D, Z = 3;
    let cy = pc.y - 110 * D; if (cy < R + 4) cy = pc.y + 110 * D; const cx = Math.min(Math.max(pc.x, R + 4), cv.width - R - 4);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    const S = v.s * Z; ctx.setTransform(S, 0, 0, S, cx - PH.pend.x * S, cy - PH.pend.y * S); ctx.drawImage(PH.src, 0, 0); ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#1F3864'; ctx.lineWidth = 3 * D; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#e4572e'; ctx.lineWidth = 1.5 * D; ctx.beginPath(); ctx.moveTo(cx - 14 * D, cy); ctx.lineTo(cx + 14 * D, cy); ctx.moveTo(cx, cy - 14 * D); ctx.lineTo(cx, cy + 14 * D); ctx.stroke(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, 112 * D, 22 * D); ctx.fillStyle = '#fff'; ctx.font = `${12 * D}px sans-serif`; ctx.fillText(`${(v.s / PH.fitS).toFixed(1)}x · ${PH.mode === 'pan' ? 'pan' : PH.tool}`, 6 * D, 15 * D); }

/* ---------- image tools ---------- */
async function commitSrc(c, flags, msg) { const r = PH.cur; if ((r.meas.length || r.ppf) && !confirm(`${msg}: this clears the scale and ${r.meas.length} measurement(s) on this sheet. Continue?`)) return false;
  r.blob = await canvasBlob(c, 'image/jpeg', 0.92); r.w = c.width; r.h = c.height; Object.assign(r, flags); r.ppf = null; r.cal = null; r.meas = []; PH.src = c; PH.pts = []; PH.corners = null; await savePh(); return true; }
async function applyFlatten() { const s = PH.src, q = PH.corners; if (!q) return; PH.busy = 'Flattening…'; status(); await new Promise(r => setTimeout(r, 30));
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y); let W = Math.max(d(q[0], q[1]), d(q[3], q[2])), H = Math.max(d(q[0], q[3]), d(q[1], q[2])); const k = Math.min(1, MAXPX / Math.max(W, H)); W = Math.round(W * k); H = Math.round(H * k);
  const out = warp(s, q, W, H); PH.busy = ''; if (await commitSrc(out, {flat:true}, 'Flatten')) { PH.tool = 'cal'; rPhoto(); } else status(); }
function warp(src, q, W, H) { const Hm = C.homography(q, [{x:0, y:0}, {x:W, y:0}, {x:W, y:H}, {x:0, y:H}]); const sw = src.width, sh = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, sw, sh).data, out = mkCanvas(W, H), og = out.getContext('2d'), od = og.createImageData(W, H), o = od.data;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const w = Hm[6] * x + Hm[7] * y + 1, fx = (Hm[0] * x + Hm[1] * y + Hm[2]) / w, fy = (Hm[3] * x + Hm[4] * y + Hm[5]) / w;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), i = (y * W + x) * 4; if (x0 < 0 || y0 < 0 || x0 >= sw - 1 || y0 >= sh - 1) { o[i] = o[i+1] = o[i+2] = 255; o[i+3] = 255; continue; }
    const ax = fx - x0, ay = fy - y0, j = (y0 * sw + x0) * 4, j2 = j + sw * 4;
    for (let c = 0; c < 3; c++) o[i + c] = (sd[j + c] * (1 - ax) + sd[j + 4 + c] * ax) * (1 - ay) + (sd[j2 + c] * (1 - ax) + sd[j2 + 4 + c] * ax) * ay; o[i + 3] = 255; }
  og.putImageData(od, 0, 0); return out; }
function threshold(src) { // Bradley-Roth adaptive threshold -> crisp black linework on white
  const w = src.width, h = src.height, g = src.getContext('2d'), d = g.getImageData(0, 0, w, h), p = d.data, gray = new Float32Array(w * h), I = new Float64Array((w + 1) * (h + 1));
  for (let i = 0; i < w * h; i++) gray[i] = 0.299 * p[i*4] + 0.587 * p[i*4+1] + 0.114 * p[i*4+2];
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += gray[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const S = Math.max(15, Math.round(Math.max(w, h) / 40)) >> 1, T = 0.15, out = mkCanvas(w, h), og = out.getContext('2d'), od = og.createImageData(w, h), o = od.data;
  for (let y = 0; y < h; y++) { const y1 = Math.max(0, y - S), y2 = Math.min(h - 1, y + S); for (let x = 0; x < w; x++) { const x1 = Math.max(0, x - S), x2 = Math.min(w - 1, x + S), n = (x2 - x1 + 1) * (y2 - y1 + 1);
    const sum = I[(y2 + 1) * (w + 1) + x2 + 1] - I[y1 * (w + 1) + x2 + 1] - I[(y2 + 1) * (w + 1) + x1] + I[y1 * (w + 1) + x1]; const v = gray[y * w + x] * n <= sum * (1 - T) ? 0 : 255, i = (y * w + x) * 4; o[i] = o[i+1] = o[i+2] = v; o[i+3] = 255; } }
  og.putImageData(od, 0, 0); return out; }
async function enhance(on) { const r = PH.cur; PH.busy = on ? 'Scanning…' : 'Restoring…'; status(); await new Promise(x => setTimeout(x, 30));
  if (on) { const keep = {ppf:r.ppf, cal:r.cal, meas:r.meas}; const out = threshold(PH.src); r.preEnh = r.blob; r.blob = await canvasBlob(out, 'image/png'); r.enh = true; PH.src = out; Object.assign(r, keep); }  // same geometry: keep scale and measurements
  else if (r.preEnh) { r.blob = r.preEnh; delete r.preEnh; r.enh = false; const bm = await createImageBitmap(r.blob); const c = mkCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0); PH.src = c; }
  PH.busy = ''; await savePh(); rPhoto(); }
async function resetOriginal() { const r = PH.cur; if (!confirm('Reset this sheet to the original image? Scale, flatten, scan and measurements are cleared.')) return;
  r.blob = r.orig; r.enh = r.flat = false; delete r.preEnh; r.ppf = null; r.cal = null; r.meas = []; const bm = await createImageBitmap(r.blob); r.w = bm.width; r.h = bm.height; await savePh(); openSheet(r.id); }

/* ---------- OCR ---------- */
async function ocrWorker() { if (PH.worker) return PH.worker; await loadScript('ocr/tesseract.min.js'); const base = new URL('ocr/', location.href).href;
  PH.worker = await Tesseract.createWorker('eng', 1, {workerPath:base + 'worker.min.js', corePath:base, langPath:base.replace(/\/$/, ''), workerBlobURL:false, gzip:true}); return PH.worker; }
function cropFor(src, x, y, w, h, enhanceIt) { x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.min(src.width - x, Math.round(w)); h = Math.min(src.height - y, Math.round(h));
  const k = Math.max(1, Math.min(3, 1600 / Math.max(w, h))); let c = mkCanvas(Math.round(w * k), Math.round(h * k)); const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, x, y, w, h, 0, 0, c.width, c.height);
  if (enhanceIt) c = threshold(c); return c; }
async function ocrBox() { const r = PH.cur, out = document.getElementById('ocrOut'), b = PH.box; const s = PH.src;
  const [x, y, w, h] = b ? [Math.min(b.a.x, b.b.x), Math.min(b.a.y, b.b.y), Math.abs(b.a.x - b.b.x), Math.abs(b.a.y - b.b.y)] : [0, 0, s.width, s.height];
  out.innerHTML = '<div class="note">Reading (offline OCR)…</div>';
  try { const wk = await ocrWorker(); const { data } = await wk.recognize(cropFor(s, x, y, w, h, !r.enh)); const sugg = C.parseCallouts(data.text);
    r.ocr.push({text:data.text.trim().slice(0, 500), sugg, box:b ? {x, y, w, h} : null}); PH.box = null; await savePh(); rPhoto(); }
  catch (e) { out.innerHTML = `<div class="note">OCR unavailable: ${esc(e.message)}</div>`; } }
async function titleBlock(r, interactive) { try { const bm = await createImageBitmap(r.blob), c = mkCanvas(bm.width, bm.height); c.getContext('2d').drawImage(bm, 0, 0);
    const wk = await ocrWorker(); const { data } = await wk.recognize(cropFor(c, c.width * 0.62, c.height * 0.78, c.width * 0.38, c.height * 0.22, true));
    const m = data.text.toUpperCase().match(/\b(?:SHEET\s*(?:NO\.?|#)?\s*)?([ASCEMPL]{1,2}\s?-?\s?\d{1,3}(?:\.\d{1,2})?[A-Z]?)\b/);
    if (m) { const nm = m[1].replace(/\s+/g, ''); if (interactive ? confirm(`Title block reads "${nm}". Use it as the sheet name?`) : r.nameAuto) { r.name = nm; r.nameAuto = false; await put('photos', r); return nm; } }
    else if (interactive) alert('No sheet number found in the title block area (bottom-right). Type it in the sheet name.'); } catch (e) { if (interactive) alert('OCR unavailable: ' + e.message); } return null; }
async function titleBlockAll() { const list = PH.sheets.filter(s => s.nameAuto); let changed = false; for (const s of list) { if (await titleBlock(s, false)) changed = true; } if (changed && document.getElementById('shName')) { if (PH.cur) PH.cur = await get1('photos', PH.cur.id); rPhoto(); } }
function suggHTML(o, i) { const label = s => s.kind === 'spacing' ? `#${s.bar} @ ${s.spacing}"${s.ew?' EW':''}${s.oc?' OC':''}${s.tb?' T&B':''}` : s.kind === 'count' ? `${s.n}-#${s.bar}${s.cont?' CONT':''}` : `${fmtFt(s.ft)} dim`;
  return `<div class="note"><div class="muted">Read: ${esc(o.text.replace(/\s+/g, ' ').slice(0, 140))}</div>${o.sugg.length ? o.sugg.map((s, j) => `<div class="mrow"><b>${esc(label(s))}</b>
    <button class="btn sm p" data-sg="${i}:${j}">Add line</button><select data-sa="${i}:${j}"><option value="">Apply to line…</option>${Q.lines.map((L, k) => `<option value="${k}">${k+1}. ${esc(L.desc)}</option>`).join('')}</select></div>`).join('') : 'No callouts like #5 @ 12" EW, 4-#6 CONT or 12\'-6" found. Box a smaller area and zoom in.'}</div>`; }
function suggLine(r, s) { const ref = `${r.name} — OCR "${s.text}"`;
  if (s.kind === 'spacing') return addLineFrom(r, 'slab', {bar:s.bar, sX:s.spacing, sY:s.spacing, layers:s.tb ? 2 : 1}, ref, `Slab ${s.text}`);
  if (s.kind === 'count') return s.cont ? addLineFrom(r, 'footing', {bar:s.bar, nLong:s.n}, ref, `Footing ${s.text}`) : addLineFrom(r, 'custom', {bar:s.bar, count:s.n, len:''}, ref, `Bars ${s.text}`);
  return addLineFrom(r, 'custom', {len:s.ft, count:1}, ref, `Length ${s.text}`); }
function bindSugg(r) { app.querySelectorAll('[data-sg]').forEach(b => b.onclick = () => { const [i, j] = b.dataset.sg.split(':').map(Number); const L = suggLine(r, r.ocr[i].sugg[j]); alert(`Added line ${Q.lines.length}: ${L.desc}`); go('takeoff'); });
  app.querySelectorAll('[data-sa]').forEach(s => s.onchange = () => { if (s.value === '') return; const [i, j] = s.dataset.sa.split(':').map(Number), sg = r.ocr[i].sugg[j], L = Q.lines[+s.value];
    if (sg.kind === 'spacing') applyCallout(L, sg); else if (sg.kind === 'count') { if ('nLong' in L.p) { L.p.nLong = sg.n; L.p.bar = sg.bar; } else if ('count' in L.p) { L.p.count = sg.n; L.p.bar = sg.bar; } }
    else { const k = ['len','LF','L'].find(k => k in L.p); if (k) L.p[k] = sg.ft; } L.src ||= srcOf(r); L.ref = (L.ref ? L.ref + '; ' : '') + `${r.name} OCR "${sg.text}"`; touch(); alert('Applied to line ' + (+s.value + 1)); }); }
function applyCallout(L, c) { const p = L.p, sp = c.spacing;
  ({slab:() => { p.bar = c.bar; p.sX = sp; p.sY = sp; if (c.tb) p.layers = 2; }, pad:() => { p.bar = c.bar; p.sp = sp; }, wall:() => { p.vBar = c.bar; p.sV = sp; if (c.ew) { p.hBar = c.bar; p.sH = sp; } },
    footing:() => { p.tieBar = c.bar; p.sTie = sp; }, ductbank:() => { p.tieBar = c.bar; p.sTie = sp; }, pier:() => { p.tieBar = c.bar; p.pitch = sp; }, custom:() => { p.bar = c.bar; }, bundle:() => { p.bar = c.bar; }, manual:() => {}})[L.type](); }
