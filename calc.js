/* Rebar-Fab Field Quote - takeoff & pricing math (shared by app and tests) */
(function (root) {
  const WT = {3:0.376,4:0.668,5:1.043,6:1.502,7:2.044,8:2.670,9:3.400,10:4.303,11:5.313,14:7.650,18:13.600};
  const DB = {3:0.375,4:0.5,5:0.625,6:0.75,7:0.875,8:1.0,9:1.128,10:1.27,11:1.41,14:1.693,18:2.257}; // in
  const DEFAULTS = { fab:0.72, straight:0.64, epoxy:0.82, wastePct:5, markupPct:10,
    truckPerLoad:1200, tonsPerLoad:24, shopPerTon:35, lapDb:40, hookDb:12, maxBar:40,
    markupFreightShop:false };
  const r2 = x => Math.round(x*100)/100;
  const r3 = x => Math.round(x*1000)/1000;
  const n = (v,d=0) => { const x=parseFloat(v); return isFinite(x)?x:d; };
  const ceilE = x => Math.ceil(x - 1e-9);
  const floorE = x => Math.floor(x + 1e-9);
  // bars at spacing s (in) across a run of `runFt` with cover c (in) each end
  const countAt = (runFt, sIn, cIn) => { if (!(sIn>0)) return 0; const clear = runFt*12 - 2*cIn; return clear<0?0:floorE(clear/sIn)+1; };

  function row(mark, bar, count, lenFt, fab, extra) {
    bar = +bar; const lf = r3(count*lenFt); const w = WT[bar]||0;
    return Object.assign({ mark, bar, count, len:r3(lenFt), lf, wt:w, lb:r2(lf*w),
      s20: lf>0?ceilE(lf/20):'', s40: lf>0?ceilE(lf/40):'', cls: fab?'Fabricated':'Straight' }, extra||{});
  }
  // splices for a bar longer than the max stock length; lap = lapDb*db
  function lapRow(r, s) {
    if (r.len <= s.maxBar) return null;
    const lapFt = s.lapDb*DB[r.bar]/12;
    const splices = ceilE((r.len - s.maxBar)/(s.maxBar - lapFt));
    const x = row(r.mark+' laps', r.bar, r.count*splices, lapFt, r.cls==='Fabricated', {isLap:true,
      note:`${splices} splice(s)/bar x ${s.lapDb}db (${r3(lapFt)} ft) — bar ${r.len} ft > ${s.maxBar} ft stock`});
    return x;
  }
  const hookFt = (bar, s, hooks) => hooks*s.hookDb*DB[bar]/12;

  // Each builder returns rows; lengths in ft, cover/spacing in inches
  const BUILD = {
    slab(p, s) { const L=n(p.L), W=n(p.W), c=n(p.cover,3), lay=n(p.layers,1), h=n(p.hooks,0);
      const rows=[];
      const nL = countAt(W, n(p.sY||p.sX), c), nW = countAt(L, n(p.sX), c);
      for (let i=0;i<lay;i++){ const tag = lay>1?(i===0?'Bot ':'Top '):'';
        rows.push(row(tag+'bars along L', p.bar, nL, L-2*c/12 + hookFt(p.bar,s,h), h>0, {calc:`floor((${W}ft x12 - 2x${c})/${n(p.sY||p.sX)})+1 = ${nL}; len ${L} - 2x${c}in${h?` + ${h} hook(s)`:''}`}));
        rows.push(row(tag+'bars along W', p.bar, nW, W-2*c/12 + hookFt(p.bar,s,h), h>0, {calc:`floor((${L}ft x12 - 2x${c})/${n(p.sX)})+1 = ${nW}; len ${W} - 2x${c}in${h?` + ${h} hook(s)`:''}`})); }
      return rows; },
    footing(p, s) { const LF=n(p.LF), b=n(p.width), d=n(p.depth), c=n(p.cover,3);
      const rows=[ row('Longitudinal', p.bar, n(p.nLong), LF, n(p.hooks,0)>0, {calc:`${n(p.nLong)} bars x ${LF} ft run`}) ];
      if (n(p.sTie)>0) { const nt = countAt(LF, n(p.sTie), c); const hk = Math.max(6*DB[p.tieBar],3);
        const len = (2*(b-2*c)+2*(d-2*c)+2*hk)/12;
        rows.push(row('Stirrups/ties', p.tieBar, nt, len, true, {calc:`floor((${LF}x12-2x${c})/${n(p.sTie)})+1 = ${nt}; len 2(${b}-2x${c})+2(${d}-2x${c})+2x${r3(hk)}in hooks`})); }
      return rows; },
    pad(p, s) { const k=n(p.count,1), L=n(p.L), W=n(p.W), c=n(p.cover,3), h=n(p.hooks,0);
      const a=countAt(W,n(p.sp),c), b=countAt(L,n(p.sp),c);
      return [ row('Pad bars along L', p.bar, k*a, L-2*c/12+hookFt(p.bar,s,h), h>0, {calc:`${k} pads x (floor((${W}x12-2x${c})/${n(p.sp)})+1 = ${a})`}),
               row('Pad bars along W', p.bar, k*b, W-2*c/12+hookFt(p.bar,s,h), h>0, {calc:`${k} pads x (floor((${L}x12-2x${c})/${n(p.sp)})+1 = ${b})`}) ]; },
    pier(p, s) { const k=n(p.count,1), D=n(p.depth), dia=n(p.dia), c=n(p.cover,3), proj=n(p.proj,0);
      const rows=[ row('Verticals', p.bar, k*n(p.nVert), D - c/12 + proj, false, {calc:`${k} x ${n(p.nVert)}; len ${D} - ${c}in cover + ${proj} ft projection`}) ];
      const core = (dia - 2*c)/12, circ = Math.PI*core;
      if (p.tieType==='spiral' && n(p.pitch)>0) { const pitch=n(p.pitch)/12, turns = (D-2*c/12)/pitch + 3;
        const len = turns*Math.sqrt(circ*circ+pitch*pitch);
        rows.push(row('Spiral', p.tieBar, k, len, true, {calc:`turns (${D}-2x${c}in)/${n(p.pitch)}in + 3 = ${r3(turns)}; x sqrt((pi x ${r3(core)})^2+${r3(pitch)}^2)`}));
      } else if (n(p.pitch)>0) { const nt = countAt(D, n(p.pitch), c); const len = circ + s.lapDb*DB[p.tieBar]/12;
        rows.push(row('Hoop ties', p.tieBar, k*nt, len, true, {calc:`${k} x (floor((${D}x12-2x${c})/${n(p.pitch)})+1 = ${nt}); len pi x ${r3(core)} + ${s.lapDb}db lap`})); }
      return rows; },
    wall(p, s) { const L=n(p.L), H=n(p.H), c=n(p.cover,2), cur=n(p.curtains,1), dw=n(p.dowel,0);
      const nv=countAt(L,n(p.sV),c), nh=countAt(H,n(p.sH),c);
      return [ row('Verticals', p.vBar, nv*cur, H - c/12 + dw, dw>0 && p.dowelBent, {calc:`(floor((${L}x12-2x${c})/${n(p.sV)})+1 = ${nv}) x ${cur} curtain(s); len ${H} - ${c}in${dw?` + ${dw} ft dowel/lap`:''}`}),
               row('Horizontals', p.hBar, nh*cur, L - 2*c/12, false, {calc:`(floor((${H}x12-2x${c})/${n(p.sH)})+1 = ${nh}) x ${cur}; len ${L} - 2x${c}in`}) ]; },
    ductbank(p, s) { return BUILD.footing(p, s).map(r=>{ if(r.mark==='Stirrups/ties') r.mark='Closed ties'; return r; }); },
    // Stock bundles: bundles x bars/bundle x stick length
    bundle(p, s) { const len = p.stick==='custom' ? n(p.customLen) : n(p.stick,20), per = n(p.perBundle), nb = n(p.bundles); if (!(per>0 && nb>0 && len>0)) return [];
      return [ row(`Bundles #${p.bar}`, p.bar, nb*per, len, p.kind==='fab', {noLap:true, calc:`${nb} bundles x ${per} bars/bundle x ${len} ft x ${WT[p.bar]} lb/LF = ${r2(nb*per*len*WT[p.bar])} lb = ${r3(nb*per*len*WT[p.bar]/2000)} T`}) ]; },
    manual(p, s) { const lb = n(p.lb) > 0 ? n(p.lb) : n(p.tons)*2000; if (!(lb>0)) return [];
      return [{ mark:'Manual entry', bar:'', count:1, len:'', lf:'', wt:'', lb:r2(lb), s20:'', s40:'', manual:true,
        cls: p.kind==='straight' ? 'Straight' : 'Fabricated', calc:`Manual: ${r2(lb)} lb = ${r3(lb/2000)} T (${p.kind||'fab'})` }]; },
    custom(p, s) { const h=n(p.hooks,0); return [ row(p.mark||'Custom', p.bar, n(p.count), n(p.len)+hookFt(p.bar,s,h), !!p.fab || h>0, {calc:`${n(p.count)} x (${n(p.len)} ft${h?` + ${h} hook(s) x ${s.hookDb}db`:''})`}) ]; },
  };

  function takeoff(line, settings) {
    const s = Object.assign({}, DEFAULTS, settings||{});
    let rows = (BUILD[line.type]||(()=>[]))(line.p||{}, s).filter(r=>r.count>0);
    if (line.fab==='fab') rows.forEach(r=>r.cls='Fabricated'); if (line.fab==='straight') rows.forEach(r=>r.cls='Straight');
    const out=[]; rows.forEach(r=>{ out.push(r); if (line.laps!==false && !r.manual && !r.noLap){ const l=lapRow(r,s); if(l) out.push(l);} });
    const lb = r2(out.reduce((a,r)=>a+r.lb,0)), lf = r3(out.reduce((a,r)=>a+(+r.lf||0),0));
    const fabLb = r2(out.filter(r=>r.cls==='Fabricated').reduce((a,r)=>a+r.lb,0));
    return { rows: out, lb, lf, fabLb, straightLb: r2(lb-fabLb), s20: lf>0?ceilE(lf/20):'', s40: lf>0?ceilE(lf/40):'' };
  }

  // trucking: {mode:'auto'|'manual', manualBy:'total'|'loads', total, loads, perLoad}
  function truckingFor(tons, s, t) {
    t = t||{mode:'auto'};
    if (t.mode==='manual') {
      if (t.manualBy==='loads') { const L=n(t.loads), P=n(t.perLoad, s.truckPerLoad); return {amt:r2(L*P), loads:L, math:`Manual: ${L} load(s) x $${P.toFixed(2)}/load`}; }
      return {amt:r2(n(t.total)), loads:null, math:`Manual: total $${n(t.total).toFixed(2)}`};
    }
    const loads = tons>0?ceilE(tons/s.tonsPerLoad):0;
    return {amt:r2(loads*s.truckPerLoad), loads, math:`Auto: ROUNDUP(${r3(tons)} T / ${s.tonsPerLoad}) = ${loads} load(s) x $${s.truckPerLoad.toFixed(2)}`};
  }

  // Full quote pricing. Returns per-line sell (Material/Trucking/Shop/Total) + internal cost.
  const RATE_KEYS = ['fab','straight','epoxy','markupPct','wastePct','truckPerLoad','tonsPerLoad','shopPerTon'];
  // market settings + per-quote overrides (blank = use market)
  function effective(q, settings) { const s = Object.assign({}, DEFAULTS, settings||{}); const ov = (q&&q.ov)||{};
    RATE_KEYS.forEach(k => { if (ov[k]!==undefined && ov[k]!=='' && isFinite(parseFloat(ov[k]))) s[k] = parseFloat(ov[k]); }); return s; }
  // Back-solve markup so the base total hits a target sell $/lb or $/T
  function solveMarkup(q, settings, target) { const s0 = effective(Object.assign({}, q, {ov:Object.assign({}, q.ov, {markupPct:0})}), settings);
    const p0 = priceQuote(Object.assign({}, q, {ov:Object.assign({}, q.ov, {markupPct:0, targetPerLb:'', targetPerTon:''})}), settings);
    const base = p0.lines.filter(l=>!l.optional && !(l.line.ovPerLb>0)), fixed = p0.lines.filter(l=>!l.optional && l.line.ovPerLb>0);
    const lb = p0.baseLb; const tgt = target.perLb ? target.perLb*lb : target.perTon*lb/2000;
    const fixedTot = fixed.reduce((a,l)=>a+l.total,0) + p0.acc.filter(a=>!a.optional).reduce((a,x)=>a+x.sell,0);
    const cost = base.reduce((a,l)=>a+l.cost,0), fr = base.reduce((a,l)=>a+l.trucking+l.shop,0) + (p0.lines.some(l=>!l.optional)?0:p0.trucking.amt);
    if (!(cost>0)) return null;
    const m = s0.markupFreightShop ? (tgt - fixedTot)/(cost+fr) - 1 : (tgt - fixedTot - fr)/cost - 1;
    return { markupPct: Math.round(m*1e6)/1e4, target:tgt, math:`markup = (${r2(tgt)} target - ${r2(fixedTot)} fixed - ${r2(fr)} trucking/shop) / ${r2(cost)} material cost - 1` }; }

  function priceQuote(q, settings) {
    let s = effective(q, settings);
    if (q.ov && (parseFloat(q.ov.targetPerLb)>0 || parseFloat(q.ov.targetPerTon)>0)) { const sol = solveMarkup(q, settings, {perLb:parseFloat(q.ov.targetPerLb)||0, perTon:parseFloat(q.ov.targetPerLb)>0?0:parseFloat(q.ov.targetPerTon)});
      if (sol) { s.markupPct = sol.markupPct; s.solved = sol; } }
    const mk = 1 + s.markupPct/100, w = 1 + s.wastePct/100, fsMk = s.markupFreightShop?mk:1;
    // Shop drawings: auto (market/override $/T), rate (quote $/T), flat ($ spread over base tons), off
    const SD = q.shop || {mode:'auto'}, sdMode = SD.mode || 'auto';
    const sdRate = sdMode==='rate' ? n(SD.rate, s.shopPerTon) : sdMode==='auto' ? s.shopPerTon : 0;
    const lines = (q.lines||[]).map(L => {
      const t = takeoff(L, s);
      const isMan = L.type==='manual' || L.type==='bundle', epx = L.epoxy || (isMan && L.p && L.p.kind==='epoxy');
      const wl = (isMan && L.p && L.p.noWaste) ? 1 : w;   // manual lines may carry 0% waste
      const lbW = r2(t.lb*wl), tons = lbW/2000;
      let cost;
      if (epx) cost = lbW*s.epoxy; else cost = (t.fabLb*s.fab + t.straightLb*s.straight)*wl;
      const ovLb = parseFloat(L.ovPerLb);
      const material = ovLb>0 ? r2(lbW*ovLb) : r2(cost*mk);
      // shop drawings on FABRICATED tons only; bundles and stock/straight bar carry none
      const fabT = L.type==='bundle' ? 0 : L.type==='manual' ? ((L.p && (L.p.stock || L.p.kind==='straight')) ? 0 : tons) : t.fabLb*wl/2000;
      const shop = r2(fabT*sdRate*fsMk);
      return { line:L, t, lbW, tons, fabT, cost:r2(cost), material, shop, trucking:0, optional:!!L.optional,
        belowCost: material < r2(cost) - 0.005 || (!(ovLb>0) && s.markupPct<=0),
        priceMath: ovLb>0 ? `Line override: ${lbW} lb x $${ovLb}/lb sell = $${material.toFixed(2)} (cost $${r2(cost).toFixed(2)})` : epx ? `${t.lb} lb x ${wl} waste = ${lbW} lb x $${s.epoxy} epoxy x ${mk} = $${material.toFixed(2)}`
          : `(${t.fabLb} fab lb x $${s.fab} + ${t.straightLb} str lb x $${s.straight}) x ${wl} waste x ${mk} = $${material.toFixed(2)}`,
        shopMath: sdMode==='flat' ? '' : sdMode==='off' ? 'Off' : `${r3(fabT)} fab T x $${sdRate}${fsMk!==1?' x '+mk:''} = $${shop.toFixed(2)}` };
    });
    const acc = (q.acc||[]).map(a => { const sell=r2(n(a.qty)*n(a.sell)); return { a, sell, cost:r2(n(a.qty)*n(a.cost)), optional:!!a.optional,
      math:`${n(a.qty)} ${a.unit||''} x $${n(a.sell).toFixed(4).replace(/0+$/,'').replace(/\.$/,'')} = $${sell.toFixed(2)}` }; });
    const base = lines.filter(l=>!l.optional), opt = lines.filter(l=>l.optional);
    const baseTons = base.reduce((a,l)=>a+l.tons,0);
    let shopInfo;
    const baseFabT = base.reduce((a,l)=>a+l.fabT,0), allFabT = lines.reduce((a,l)=>a+l.fabT,0);
    if (sdMode==='flat') { const F = baseFabT>0 ? r2(n(SD.flat)*fsMk) : 0; const fl = base.filter(l=>l.fabT>0); let left = F; base.forEach(l=>{ l.shop = 0; l.shopMath = 'Stock bar: no shop drawings'; });
      fl.forEach((l,i)=>{ l.shop = i===fl.length-1 ? r2(left) : r2(F*l.fabT/baseFabT); left -= l.shop; l.shopMath = `${r3(l.fabT)} / ${r3(baseFabT)} fab T share of flat $${F.toFixed(2)}`; });
      opt.forEach(l=>{ l.shop = 0; l.shopMath = 'Included in flat amount'; }); shopInfo = {mode:'flat', amt:F, fabT:r3(baseFabT), math:`Flat: $${F.toFixed(2)} spread over ${r3(baseFabT)} fabricated T${baseFabT===0?' (stock bar only: $0.00)':''}`}; }
    else { const amt = r2(base.reduce((a,l)=>a+l.shop,0));
      shopInfo = {mode:sdMode, rate:sdRate, amt, fabT:r3(baseFabT), math: sdMode==='off' ? 'Off: $0.00' : `${sdMode==='rate'?'Rate override':'Auto'}: ${r3(baseFabT)} fabricated T x $${sdRate}/T = $${amt.toFixed(2)}${baseFabT===0?' (stock bar only)':''}${(allFabT-baseFabT)>0?` · optional ${r3(allFabT-baseFabT)} fab T x $${sdRate}/T separately`:''}`}; }
    const tr = truckingFor(baseTons, s, q.trucking); tr.amt = r2(tr.amt*fsMk);
    // allocate base trucking by tonnage, last line takes rounding remainder
    let left = tr.amt; base.forEach((l,i)=>{ l.trucking = i===base.length-1 ? r2(left) : r2(baseTons>0? tr.amt*l.tons/baseTons : 0); left -= l.trucking;
      l.truckMath = `${r3(l.tons)} / ${r3(baseTons)} T share of $${tr.amt.toFixed(2)}`; });
    if (!base.length && tr.amt) { /* manual trucking with no base lines */ }
    const perLoad = (q.trucking&&q.trucking.mode==='manual'&&q.trucking.manualBy==='loads') ? n(q.trucking.perLoad,s.truckPerLoad) : s.truckPerLoad;
    opt.forEach(l=>{ const ld = l.tons>0?ceilE(l.tons/s.tonsPerLoad):0; l.trucking = r2(ld*perLoad*fsMk); l.truckMath=`ROUNDUP(${r3(l.tons)}/${s.tonsPerLoad}) = ${ld} load(s) x $${perLoad}`; });
    lines.forEach(l=>{ l.total = r2(l.material+l.trucking+l.shop); l.perTon = l.tons?r2(l.total/l.tons):0; l.perLb = l.lbW?Math.round(l.total/l.lbW*10000)/10000:0; });
    const sum = (arr,k)=>r2(arr.reduce((a,x)=>a+x[k],0));
    const baseTotal = r2(sum(base,'total') + sum(acc.filter(a=>!a.optional),'sell') + (base.length?0:tr.amt));
    const optTotal = r2(sum(opt,'total') + sum(acc.filter(a=>a.optional),'sell'));
    return { s, lines, acc, trucking:tr, shopInfo, baseTons:r3(baseTons), baseTotal, optTotal, grand:r2(baseTotal+optTotal),
      baseLb:r2(base.reduce((a,l)=>a+l.lbW,0)), internalCost:r2(lines.reduce((a,l)=>a+l.cost,0)+acc.reduce((a,x)=>a+x.cost,0)) };
  }
  // Complete Manual Quote: typed line items, no takeoff, no auto rates.
  // Material = typed Material $ if entered, else qty x unit sell. Total = Material + Trucking + Shop Drawings.
  // Tons: LB -> qty/2000, T -> qty, other units -> optional typed tons.
  const UNITS = ['LB','T','EA','LS','LF'];
  function priceManual(q) {
    const lines = (q.mlines||[]).map(M => { const qty = n(M.qty), price = n(M.price), ext = r2(qty*price);
      const hasMat = M.mat!==undefined && M.mat!=='' && isFinite(parseFloat(M.mat));
      const material = hasMat ? r2(n(M.mat)) : ext, trucking = r2(n(M.truck)), shop = r2(n(M.shop));
      const tons = M.unit==='LB' ? qty/2000 : M.unit==='T' ? qty : n(M.tons);
      const lbW = r2(tons*2000), total = r2(material+trucking+shop);
      return { line:{desc:M.desc||'', ref:M.ref||'', epoxy:false, qtyText:`${qty.toLocaleString('en-US')} ${M.unit||''}`}, m:M, qty, ext, lbW, tons, cost:0, material, trucking, shop, total, optional:!!M.optional,
        perTon: tons>0 ? r2(total/tons) : 0, perLb: lbW>0 ? Math.round(total/lbW*10000)/10000 : 0,
        math: `${hasMat ? `Material typed $${material.toFixed(2)}` : `${qty} ${M.unit} x $${price} = $${ext.toFixed(2)}`} + trucking $${trucking.toFixed(2)} + shop $${shop.toFixed(2)} = $${total.toFixed(2)}${tons>0?` · ${r3(tons)} T`:''}` }; });
    const base = lines.filter(l=>!l.optional), opt = lines.filter(l=>l.optional), sum = (a,k)=>r2(a.reduce((x,l)=>x+l[k],0));
    const baseTotal = sum(base,'total'), optTotal = sum(opt,'total');
    return { manual:true, s:{markupPct:0}, lines, acc:[], trucking:{amt:sum(base,'trucking'), math:'Typed'}, baseTons:r3(base.reduce((a,l)=>a+l.tons,0)),
      baseLb: r2(base.reduce((a,l)=>a+l.lbW,0)), baseTotal, optTotal, grand:r2(baseTotal+optTotal), internalCost:0 };
  }
  const priceAny = (q, s) => q && q.manual ? priceManual(q) : priceQuote(q, s);
  // Chairs/dobies at a 4'x4' grid
  function chairGrid(L, W, layers, grid=4) { const nx = ceilE(n(L)/grid)+1, ny = ceilE(n(W)/grid)+1; const per = nx*ny;
    return { per, dobies: per, chairs: n(layers)>1?per:0, math:`(ROUNDUP(${L}/${grid})+1) x (ROUNDUP(${W}/${grid})+1) = ${nx} x ${ny} = ${per}` }; }
  // Plan photo scale: pixels per foot from two points and a real length
  const dist = (a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function pxPerFt(p1,p2,ft){ return dist(p1,p2)/ft; }
  function polyLen(pts){ let s=0; for(let i=1;i<pts.length;i++) s+=dist(pts[i-1],pts[i]); return s; }
  function polyArea(pts){ let a=0; for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length]; a+=p.x*q.y-q.x*p.y;} return Math.abs(a)/2; }
  function parseCallout(txt){ const m = String(txt).replace(/[“”″]/g,'"').match(/#\s*(1[01]|[3-9])\s*(?:@|at|AT)\s*(\d+(?:\.\d+)?)\s*("|in|”|'')?\s*(?:O\.?C\.?)?\s*(EW|E\.W\.|EACH WAY)?/i);
    return m ? { bar:+m[1], spacing:+m[2], ew:!!m[4] } : null; }
  // OCR text -> rebar callout suggestions
  function normOCR(t){ return String(t).replace(/[“”″〃]/g,'"').replace(/[‘’′`]/g,"'").replace(/[–—]/g,'-').replace(/(\d)\s*''/g,'$1"'); }
  function parseCallouts(text){ const t = normOCR(text), out = [], seen = new Set(); const add = o => { const k = JSON.stringify(o); if (!seen.has(k)) { seen.add(k); out.push(o); } };
    let m; const reS = /#\s*(1[01]|[3-9])\s*(?:@|AT|at)\s*(\d+(?:\.\d+)?)\s*(?:"|IN\b|in\b)?\s*(O\.?\s*C\.?|E\.?\s*W\.?|EACH\s*WAY|T\s*&\s*B|T\.?\s*&\s*B\.?)?/g;
    while ((m = reS.exec(t))) { const q = (m[3]||'').toUpperCase().replace(/[\s.]/g,''); add({kind:'spacing', bar:+m[1], spacing:+m[2], ew:q==='EW'||q==='EACHWAY', oc:q==='OC', tb:q==='T&B', text:m[0].trim()}); }
    const reN = /\b(\d{1,3})\s*[-x]?\s*#\s*(1[01]|[3-9])\b\s*(CONT\.?|CONTINUOUS)?/gi;
    while ((m = reN.exec(t))) add({kind:'count', n:+m[1], bar:+m[2], cont:!!m[3], text:m[0].trim()});
    const reD = /\b(\d{1,4})\s*'\s*-?\s*(\d{1,2}(?:\.\d+)?)?(?:\s+(\d)\/(\d))?\s*"?/g;
    while ((m = reD.exec(t))) { const ft = +m[1] + ((+m[2]||0) + (m[3]? m[3]/m[4] : 0))/12; add({kind:'dim', ft:r3(ft), text:m[0].trim()}); }
    return out; }
  // printed scale like 1/8"=1'-0", 3/32" = 1'-0", 1"=20', 1/4"=1' -> paper inches per real foot
  function parseScale(str){ const t = normOCR(str).replace(/\s+/g,''); const m = t.match(/^(\d+(?:\.\d+)?)(?:\/(\d+))?"?=(\d+(?:\.\d+)?)'(?:-?(\d+(?:\.\d+)?)"?)?$/);
    if (!m) return null; const inch = m[2] ? (+m[1])/(+m[2]) : +m[1]; const ft = +m[3] + (+(m[4]||0))/12; return ft>0 ? inch/ft : null; }
  // pixels/ft from a printed scale + the printed sheet width (in) spanning imgWidthPx
  function ppfFromScale(scaleStr, sheetWidthIn, imgWidthPx){ const ipf = parseScale(scaleStr); if (!ipf || !(sheetWidthIn>0)) return null; return imgWidthPx / (sheetWidthIn/ipf); }
  // homography: maps (u,v) in dst rect to src quad; 4 point pairs
  function homography(src, dst){ // returns H such that src ~ H * dst
    const A=[], b=[]; for (let i=0;i<4;i++){ const {x:u,y:v}=dst[i], {x,y}=src[i];
      A.push([u,v,1,0,0,0,-u*x,-v*x]); b.push(x); A.push([0,0,0,u,v,1,-u*y,-v*y]); b.push(y); }
    for (let c=0;c<8;c++){ let p=c; for(let r=c+1;r<8;r++) if(Math.abs(A[r][c])>Math.abs(A[p][c])) p=r; [A[c],A[p]]=[A[p],A[c]]; [b[c],b[p]]=[b[p],b[c]];
      for (let r=0;r<8;r++){ if(r===c) continue; const f=A[r][c]/A[c][c]; for(let k=c;k<8;k++) A[r][k]-=f*A[c][k]; b[r]-=f*b[c]; } }
    const h=b.map((v,i)=>v/A[i][i]); return [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1]; }
  const applyH=(H,u,v)=>{ const w=H[6]*u+H[7]*v+1; return {x:(H[0]*u+H[1]*v+H[2])/w, y:(H[3]*u+H[4]*v+H[5])/w}; };
  const money = x => (x<0?'-':'')+'$'+Math.abs(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
  const api = { parseCallouts, parseScale, ppfFromScale, homography, applyH, priceManual, priceAny, UNITS, effective, solveMarkup, RATE_KEYS, WT, DB, DEFAULTS, takeoff, priceQuote, truckingFor, chairGrid, pxPerFt, polyLen, polyArea, parseCallout, money, countAt };
  if (typeof module!=='undefined') module.exports = api; else root.RFCalc = api;
})(this);
