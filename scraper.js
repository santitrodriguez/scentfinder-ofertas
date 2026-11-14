(() => {
const P = [
 {id:'sauvage-edt', b:['dior'], q:'sauvage', q2:['dior sauvage'], inc:['sauvage'], c:'edt', exc:['eau sauvage','extreme','intense','elixir','very cool','fraiche']},
 {id:'bleu-chanel-edp', b:['chanel'], q:'bleu de chanel', q2:['chanel bleu'], inc:['bleu'], c:'edp', exc:[]},
 {id:'le-beau-edt', b:['gaultier'], q:'le beau', q2:['jean paul gaultier le beau'], inc:['le beau'], c:'edt', exc:['paradise','parfum','elixir','intense','edp','flower','garden']},
 {id:'invictus-edt', b:['rabanne'], q:'invictus', q2:[], inc:['invictus'], c:'edt', exc:['victory','platinum','legend','onyx','aqua','intense','absolu','elixir','parfum']},
 {id:'phantom-edt', b:['rabanne'], q:'phantom', q2:[], inc:['phantom'], c:'edt', exc:['parfum','intense','elixir','legion','edp']},
 {id:'212-vip-men-edt', b:['carolina herrera','herrera'], q:'212 vip men', q2:[], inc:['212','vip'], c:'edt', exc:['black','rose','wins','club','nyc','woman','mujer','her','party','elixir','parfum']},
 {id:'bad-boy-edt', b:['carolina herrera','herrera'], q:'bad boy', q2:[], inc:['bad boy'], c:'edt', exc:['cobalt','extreme','parfum','elixir','dazzling']},
 {id:'le-male-edt', b:['gaultier'], q:'le male', q2:[], inc:['le male'], c:'edt', exc:['elixir','parfum','lover','pride','aviator','essence','in blue','edp','absolu']},
 {id:'le-male-elixir', b:['gaultier'], q:'le male elixir', q2:[], inc:['le male','elixir'], c:'*', exc:['absolu']},
 {id:'acqua-di-gio-edt', b:['armani'], q:'acqua di gio', q2:[], inc:['acqua di gio'], c:'edt', exc:['profumo','profondo','parfum','elixir','absolu','donna','femme','woman','edp']},
 {id:'armani-code-edt', b:['armani'], q:'armani code', q2:[], inc:['code'], c:'edt', exc:['profumo','parfum','absolu','elixir','intense','femme','woman','colonia','edp','red','ice']},
 {id:'stronger-with-you-intensely', b:['armani'], q:'stronger with you intensely', q2:['stronger with you'], inc:['stronger','intensely'], c:'*', exc:['parfum','absolutely','powerfully']},
 {id:'eros-edt', b:['versace'], q:'versace eros', q2:[], inc:['eros'], c:'edt', exc:['flame','energy','parfum','edp','najim','femme','elixir']},
 {id:'dylan-blue-edt', b:['versace'], q:'dylan blue', q2:['versace dylan blue pour homme'], inc:['dylan blue'], c:'edt', exc:['femme','edp','parfum']},
 {id:'boss-bottled-edt', b:['boss'], q:'boss bottled', q2:[], inc:['bottled'], c:'edt', exc:['parfum','elixir','night','infinite','intense','absolute','united','marine','edp','beyond','triumph','tonic','unlimited']},
 {id:'most-wanted-edp', b:['azzaro'], q:'the most wanted', q2:['azzaro most wanted'], inc:['most wanted'], c:'edp', exc:['parfum','edt','elixir','toilette']},
 {id:'d-red-edp', b:['diesel'], q:'diesel red', q2:['d red'], inc:['red'], c:'*', exc:['fuel','loverdose']},
 {id:'born-in-roma-uomo-edt', b:['valentino'], q:'born in roma uomo', q2:['valentino uomo'], inc:['born in roma','uomo'], c:'edt', exc:['intense','coral','green','extradose','donna','parfum','edp','yellow','rendez','purple','melancholia']},
 {id:'ysl-y-edp', b:['saint laurent','ysl'], q:'y men', q2:['yves saint laurent y'], inc:['__Y__'], c:'edp', exc:['intense','elixir','le parfum','edt','myslf','libre','opium','homme','l homme','mon paris','toilette']},
 {id:'light-blue-pour-homme-edt', b:['dolce','gabbana','d&g'], q:'light blue pour homme', q2:[], inc:['light blue'], c:'edt', exc:['forever','intense','summer','capri','femme','italian','love','sun','eau intense','parfum'], need:['homme','uomo','men']},
];
const GLOBAL_EXC = ['set','kit','estuche','coffret','+','tester','deo','desodorante','gel','shower','after shave','aftershave','balm','body','mini','travel','recarga','refill','vial','sample','muestra','miniatura','pack','combo','bolso','bag','llavero','neceser','botella','termica'];
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[-–|]/g,' ').replace(/\s+/g,' ').trim();
const esc = t => t.replace(/[.*+?^${}()|[\]\\&]/g,'\\$&');
const has = (n,t) => new RegExp('(^|[^a-z0-9])'+esc(t)+'($|[^a-z0-9])').test(n);
function conc(n){ if (/elixir/.test(n)) return 'elixir'; if (/\bedp\b|eau de parfum|eau parfum/.test(n)) return 'edp'; if (/\bedt\b|eau de toilette|toilette/.test(n)) return 'edt'; if (/\bparfum\b|extrait/.test(n)) return 'parfum'; if (/cologne|colonia|\bedc\b/.test(n)) return 'edc'; return '?'; }
function match(p, name, brand){
  const n = norm(name), bn = norm(brand)+' '+n;
  if (!p.b.some(b=>bn.includes(b))) return false;
  for (const t of p.inc){ if (t==='__Y__'){ if (!/(^|\s)y(\s|$)/.test(n.replace(/yves saint laurent|saint laurent|ysl/g,' '))) return false; } else if (!n.includes(t)) return false; }
  if (p.need && !p.need.some(t=>has(n,t))) return false;
  for (const t of p.exc){ if (t==='edp'||t==='edt'||t==='parfum') continue; if (has(n,t)) return false; }
  for (const t of GLOBAL_EXC){ if (t==='+' ? n.includes('+') : has(n,t)) return false; }
  if (p.c === '*') return true;
  return conc(n) === p.c;
}
const mlOf = s => { const m = norm(s).match(/(\d{2,3})\s?ml/); return m? +m[1] : null; };
async function pool(items, n, fn){ let i=0; await Promise.all(Array.from({length:n}, async()=>{ while(i<items.length){ const k=i++; try{await fn(items[k]);}catch(e){ try{await fn(items[k]);}catch(e2){} } } })); }
const jobs = () => P.flatMap(p=>[p.q, ...(p.q2||[])].map(q=>[p,q]));
function mkPut(out){ return (pid, ml, price, list, stock, url) => { if (!ml || ml < 30 || ml > 200 || !price) return; out[pid] = out[pid] || {}; const cur = out[pid][ml]; const cand = [Math.round(price), Math.round(list && list>price? list : price), stock?1:0, url]; if (!cur || (cand[2] > cur[2]) || (cand[2]===cur[2] && cand[0] < cur[0])) out[pid][ml] = cand; }; }

async function vtex(){
  const out = {}, put = mkPut(out);
  await pool(jobs(), 6, async ([p,q]) => {
    const j = await fetch('/api/io/_v/api/intelligent-search/product_search/?query='+encodeURIComponent(q)+'&count=50&locale=es-AR').then(r=>r.json());
    for (const pr of (j.products||[])){
      const path = (pr.link||'').replace(/^https?:\/\/[^/]+/,'') || ('/'+pr.linkText+'/p');
      for (const it of pr.items||[]){
        if (!match(p, pr.productName+' '+it.name, pr.brand)) continue;
        const o = (it.sellers||[])[0]?.commertialOffer||{};
        put(p.id, mlOf(it.name)||mlOf(pr.productName), o.Price, o.ListPrice, o.AvailableQuantity>0, path);
      }
    }
  });
  return out;
}
async function magento(){
  const out = {}, put = mkPut(out), cands = [];
  await pool(jobs(), 4, async ([p,q]) => {
    const html = await fetch('/catalogsearch/result/?q='+encodeURIComponent(q)).then(r=>r.text());
    const d = new DOMParser().parseFromString(html,'text/html');
    for (const c of d.querySelectorAll('.product-item')){
      const t = c.textContent.replace(/\s+/g,' ').replace(/\$.*$/,'').trim();
      const a = c.querySelector('a[href]'); if (!a) continue;
      if (match(p, t, '')) cands.push([p, a.getAttribute('href').split('?')[0], t]);
    }
  });
  const seen = new Set();
  await pool(cands.filter(c=>{const k=c[0].id+c[1]; if(seen.has(k))return false; seen.add(k); return true;}), 4, async ([p, href, t]) => {
    const html = await fetch(href).then(r=>r.text());
    const d = new DOMParser().parseFromString(html,'text/html');
    const path = href.replace(/^https?:\/\/[^/]+/,'');
    let cfg=null;
    for (const el of d.querySelectorAll('*')){ for (const a of el.attributes){ if (a.value.includes('"optionPrices"')){ cfg=a.value; break; } } if (cfg) break; }
    const grab = (s,key)=>{ const i=s.indexOf('"'+key+'":'); if(i<0) return null; let k=s.indexOf('{',i), dep=0; for(let q=k;q<s.length;q++){ if(s[q]=='{')dep++; else if(s[q]=='}'){dep--; if(!dep) return JSON.parse(s.slice(k,q+1));} } };
    if (cfg){
      const op=grab(cfg,'optionPrices')||{}, at=grab(cfg,'attributes')||{}, dyn=grab(cfg,'dynamic')||{};
      for (const a of Object.values(at)) for (const o of a.options) for (const pid of o.products){
        const pr = op[pid]; if (!pr) continue;
        const qty = dyn.stock?.[pid]?.qty;
        put(p.id, mlOf(o.label), pr.finalPrice.amount, pr.oldPrice.amount, qty===undefined? 1 : qty>0, path);
      }
    } else {
      const fp = d.querySelector('meta[property="product:price:amount"]')?.content;
      const av = d.querySelector('meta[property="product:availability"]')?.content||'';
      const h1 = d.querySelector('h1')?.textContent||t;
      if (match(p, h1, t)) put(p.id, mlOf(h1)||mlOf(href), +fp, +fp, /in stock/i.test(av), path);
    }
  });
  return out;
}
async function tiendanube(){
  const out = {}, put = mkPut(out), cands = [];
  await pool(jobs(), 4, async ([p,q]) => {
    const html = await fetch('/search/?q='+encodeURIComponent(q)).then(r=>r.text());
    const d = new DOMParser().parseFromString(html,'text/html');
    const links = new Map();
    for (const a of d.querySelectorAll('a[href*="/productos/"]')){
      const href = a.getAttribute('href').split('?')[0]; if (/\/productos\/?$/.test(href)) continue;
      const card = a.closest('[class*="item"]')||a;
      const t = (a.getAttribute('title')||'')+' '+card.textContent.replace(/\s+/g,' ').replace(/\$.*$/,'');
      links.set(href, ((links.get(href)||'')+' '+t).slice(0,300));
    }
    for (const [href,t] of links){ if (match(p, t, '')) cands.push([p, href]); }
  });
  const seen = new Set();
  await pool(cands.filter(c=>{const k=c[0].id+c[1]; if(seen.has(k))return false; seen.add(k); return true;}), 4, async ([p, href]) => {
    const html = await fetch(href).then(r=>r.text());
    const d = new DOMParser().parseFromString(html,'text/html');
    const h1 = d.querySelector('h1')?.textContent||'';
    if (!match(p, h1, '')) return;
    const el = d.querySelector('[data-variants]'); if (!el) return;
    const path = href.replace(/^https?:\/\/[^/]+/,'');
    for (const v of JSON.parse(el.getAttribute('data-variants'))){
      const ml = mlOf(v.option0||'') || mlOf(v.option1||'') || mlOf(h1);
      put(p.id, ml, v.price_number, v.compare_at_price_number, v.available && (v.stock===null || v.stock>0), path);
    }
  });
  return out;
}
window.SF = {P, match, norm, conc, mlOf};
window.SF_RUN = async (kind) => { window.__SF = await ({vtex, magento, tiendanube}[kind])(); window.__SFJ = JSON.stringify(window.__SF); return 'ok perfumes=' + Object.keys(window.__SF).length + ' chars=' + window.__SFJ.length + ' missing: ' + P.map(p=>p.id).filter(id=>!window.__SF[id]).join(','); };
})();
