// Cruza los precios de todas las tiendas, detecta ofertas, guarda el historial del día
// y escribe data/ofertas.json (lo que lee la página).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { STORES, MIN_DISCOUNT, MIN_ML, MAX_ML, TZ } from '../config.js';
import { conc, brandKey, nameKey, displayName, brandDisplay, isExcluded, cleanEan, norm } from '../lib/normalize.js';

const dateAR = d => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const now = new Date();
const today = dateAR(now);
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
// Foto del producto en un tamaño liviano (las tiendas sirven la original en alta resolución).
const imgSmall = u => !u ? null : u
  .replace(/^http:/, 'https:')
  .replace(/(\/arquivos\/ids\/\d+)(-\d+-\d+)?\//, '$1-300-300/')          // VTEX
  .replace(/-(\d+)-(\d+)\.(webp|jpg|jpeg|png)$/i, '-480-0.$3');           // Tiendanube
// Preferimos fotos de VTEX (fondo blanco y cuadradas) y después el resto.
const IMG_ORDER = ['juleriaque', 'rouge', 'beauty24', 'pigmento', 'ruizyroca', 'parfumerie'];
const pickImage = list => imgSmall([...list].filter(r => r.image).sort((a, b) => IMG_ORDER.indexOf(a.store) - IMG_ORDER.indexOf(b.store))[0]?.image);
const isOffer = r => r.stock && r.list > 0 && r.price <= r.list * (1 - MIN_DISCOUNT) + 0.5;
const pctOf = r => (r.list > r.price ? Math.round((1 - r.price / r.list) * 100) : 0);

// ---------- 1. Cargar lo leído de cada tienda ----------
const status = fs.existsSync('data/raw/_status.json') ? JSON.parse(fs.readFileSync('data/raw/_status.json', 'utf8')) : {};
const storesMeta = [];
const rows = [];
for (const s of STORES) {
  const file = `data/raw/${s.id}.json`;
  const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const st = status[s.id] || {};
  storesMeta.push({
    id: s.id, name: s.name, url: s.url,
    lastRead: raw?.readAt || null,
    fresh: !!raw && dateAR(raw.readAt) === today,
    ok: st.ok ?? !!raw,
    error: st.ok === false ? st.error : null,
  });
  if (!raw) continue;
  for (const r of raw.rows) {
    const full = `${r.title} ${r.variant || ''}`;
    if (!r.ml || r.ml < MIN_ML || r.ml > MAX_ML || !r.price) continue;
    if (isExcluded(full)) continue;
    const c = conc(full) || conc(r.category) || null;
    const bk = brandKey(r.brand);
    const nk = nameKey(r.title, r.brand);
    rows.push({
      ...r, store: s.id, readAt: raw.readAt, conc: c, bk, nk,
      ean: cleanEan(r.ean),
      sizeKey: `${bk}|${nk}|${c || '?'}|${r.ml}`,
    });
  }
}

// Concentración desconocida: si con la misma marca+nombre+ml hay una sola concentración conocida, se usa esa.
const concBy = new Map();
for (const r of rows) if (r.conc) { const k = `${r.bk}|${r.nk}|${r.ml}`; (concBy.get(k) || concBy.set(k, new Set()).get(k)).add(r.conc); }
for (const r of rows) if (!r.conc) {
  const set = concBy.get(`${r.bk}|${r.nk}|${r.ml}`);
  if (set?.size === 1) { r.conc = [...set][0]; r.sizeKey = `${r.bk}|${r.nk}|${r.conc}|${r.ml}`; }
}

// ---------- 2. Agrupar el mismo frasco entre tiendas (EAN primero, después marca+nombre+concentración+ml) ----------
const parent = rows.map((_, i) => i);
const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
const firstBy = new Map();
rows.forEach((r, i) => {
  const keys = [];
  if (r.ean) keys.push(`ean|${r.ean}|${r.ml}`);
  if (r.nk) keys.push(`name|${r.sizeKey}`);
  for (const k of keys) { if (firstBy.has(k)) union(firstBy.get(k), i); else firstBy.set(k, i); }
});
const clusters = new Map();
rows.forEach((r, i) => { const c = find(i); (clusters.get(c) || clusters.set(c, []).get(c)).push(r); });

const STORE_ORDER = STORES.map(s => s.id);
const mode = arr => { const m = new Map(); let best = null, n = 0; for (const x of arr) { if (x == null) continue; const v = (m.get(x) || 0) + 1; m.set(x, v); if (v > n) { n = v; best = x; } } return best; };

// ---------- 3. Historial ----------
fs.mkdirSync('history', { recursive: true });
const histRows = {};
for (const r of rows) {
  if (dateAR(r.readAt) !== today) continue; // solo lecturas de hoy (las tiendas que fallaron no se repiten)
  (histRows[r.store] ||= []).push([h(r.ean ? 'ean|' + r.ean : 'name|' + r.sizeKey), r.price, r.list, r.stock ? 1 : 0]);
}
fs.writeFileSync(`history/${today}.json`, JSON.stringify({ date: today, generatedAt: now.toISOString(), minDiscount: MIN_DISCOUNT, rows: histRows }));
const history = fs.readdirSync('history').filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().reverse().slice(0, 365)
  .map(f => JSON.parse(fs.readFileSync(`history/${f}`, 'utf8')))
  .map(d => ({ date: d.date, min: d.minDiscount ?? MIN_DISCOUNT, byStore: Object.fromEntries(Object.entries(d.rows).map(([s, list]) => {
    const m = new Map(); for (const [id, p, l, st] of list) { const prev = m.get(id); if (!prev) m.set(id, [[p, l, st]]); else prev.push([p, l, st]); } return [s, m];
  })) }));

function histFor(ids) {
  // días seguidos en oferta por tienda, y precio más bajo visto con stock
  const days = {}, broken = {};
  let minSeen = null;
  for (const d of history) {
    for (const [store, m] of Object.entries(d.byStore)) {
      const hits = ids.flatMap(id => m.get(id) || []);
      if (!hits.length) continue;
      for (const [p, , st] of hits) if (st && (!minSeen || p < minSeen.price)) minSeen = { price: p, store, date: d.date };
      if (broken[store]) continue;
      const on = hits.some(([p, l, st]) => st && l > 0 && p <= l * (1 - d.min) + 0.5);
      if (on) days[store] = (days[store] || 0) + 1; else broken[store] = true;
    }
  }
  return { days, minSeen };
}

// ---------- 4. Armar productos y ofertas ----------
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const products = {};
const offers = [];
const usedSlugs = new Map();

const clusterInfo = [];
for (const list of clusters.values()) {
  const ml = list[0].ml;
  const rep = [...list].sort((a, b) => STORE_ORDER.indexOf(a.store) - STORE_ORDER.indexOf(b.store))[0];
  const c = mode(list.map(r => r.conc));
  const productKey = mode(list.map(r => `${r.bk}|${r.nk}|${r.conc || c || '?'}`));
  clusterInfo.push({ list, ml, rep, conc: c, productKey });
}
// productos (agrupa tamaños): por productKey
const byProduct = new Map();
for (const ci of clusterInfo) (byProduct.get(ci.productKey) || byProduct.set(ci.productKey, []).get(ci.productKey)).push(ci);

for (const [pk, cis] of byProduct) {
  const all = cis.flatMap(ci => ci.list);
  // título para mostrar: preferimos uno que no esté todo en mayúsculas
  const caps = r => (r.title === r.title.toUpperCase() ? 1 : 0);
  const rep = [...all].sort((a, b) => caps(a) - caps(b) || STORE_ORDER.indexOf(a.store) - STORE_ORDER.indexOf(b.store))[0];
  const brand = brandDisplay(mode(all.filter(r => r.store === rep.store).map(r => r.brand)) || rep.brand);
  const name = displayName(rep.title, rep.brand);
  const conc_ = mode(all.map(r => r.conc));
  let id = slug(`${brand} ${name} ${conc_ || ''}`) || h(pk);
  if (usedSlugs.has(id) && usedSlugs.get(id) !== pk) id = `${id}-${h(pk).slice(0, 4)}`;
  usedSlugs.set(id, pk);

  const sizes = {};
  for (const ci of cis) {
    // por tienda: el precio más barato con stock (si no hay stock, el último publicado, marcado sin stock)
    const entries = [];
    for (const sid of STORE_ORDER) {
      const mine = ci.list.filter(r => r.store === sid);
      if (!mine.length) continue;
      const inStock = mine.filter(r => r.stock).sort((a, b) => a.price - b.price);
      const offersHere = inStock.filter(isOffer);
      const r = offersHere[0] && (!inStock[0] || offersHere[0].price <= inStock[0].price) ? offersHere[0] : inStock[0] || [...mine].sort((a, b) => a.price - b.price)[0];
      entries.push({
        store: sid, price: r.price, list: r.list, pct: pctOf(r), stock: r.stock, offer: isOffer(r),
        url: r.url, ean: r.ean, date: dateAR(r.readAt), title: `${r.title}${r.variant && !r.title.includes(r.variant) ? ' · ' + r.variant : ''}`,
      });
    }
    const ids = [...new Set(ci.list.flatMap(r => [r.ean ? h('ean|' + r.ean) : null, h('name|' + r.sizeKey)]).filter(Boolean))];
    const { days, minSeen } = histFor(ids);
    const size = { ml: ci.ml, ean: mode(ci.list.map(r => r.ean)), image: pickImage(ci.list), entries, daysOnSale: days, minSeen };
    if (sizes[ci.ml]) { // dos grupos con el mismo ml (EAN distinto sin nombre común): nos quedamos con el de más tiendas
      if (sizes[ci.ml].entries.length >= entries.length) continue;
    }
    sizes[ci.ml] = size;
  }

  const productImage = pickImage(all);
  let hasOffer = false;
  for (const size of Object.values(sizes)) {
    for (const e of size.entries) {
      if (!e.offer) continue;
      hasOffer = true;
      const others = size.entries.filter(x => x.store !== e.store);
      const stocked = others.filter(x => x.stock);
      const worst = stocked.sort((a, b) => b.price - a.price)[0];
      offers.push({
        id: `${id}--${size.ml}--${e.store}`, productId: id,
        brand, name, conc: conc_, ml: size.ml, store: e.store,
        price: e.price, list: e.list, pct: e.pct, stock: e.stock, url: e.url, ean: e.ean || size.ean || null, date: e.date,
        image: size.image || productImage,
        save: worst && worst.price > e.price ? worst.price - e.price : 0, saveVs: worst?.store || null,
        others: others.map(x => ({ store: x.store, price: x.price, stock: x.stock, offer: x.offer })).sort((a, b) => (b.stock - a.stock) || (a.price - b.price)),
        daysOnSale: size.daysOnSale[e.store] || 1, minSeen: size.minSeen,
      });
    }
  }
  if (hasOffer) products[id] = { brand, name, conc: conc_, image: productImage, sizes };
}

offers.sort((a, b) => b.pct - a.pct || a.price - b.price);
const out = {
  generatedAt: now.toISOString(), date: today, minDiscount: MIN_DISCOUNT,
  historyFrom: history.length ? history[history.length - 1].date : today,
  stores: storesMeta, count: offers.length, offers, products,
};
fs.mkdirSync('data', { recursive: true });
// una oferta / producto por línea para que el historial de git sea liviano
const lines = (obj) => Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}:${JSON.stringify(v)}`).join(',\n');
fs.writeFileSync('data/ofertas.json', `{${lines({ generatedAt: out.generatedAt, date: out.date, minDiscount: out.minDiscount, historyFrom: out.historyFrom, stores: out.stores, count: out.count })},
"offers":[
${offers.map(o => JSON.stringify(o)).join(',\n')}
],
"products":{
${lines(products)}
}}
`);

const perStore = Object.fromEntries(STORES.map(s => [s.name, offers.filter(o => o.store === s.id).length]));
const matched = offers.filter(o => o.others.length).length;
console.log(`Filas válidas: ${rows.length} · frascos distintos: ${clusters.size}`);
console.log(`Ofertas: ${offers.length} (${matched} con precio en otra tienda)`, perStore);
console.log(`Historial: history/${today}.json · días con historial: ${history.length}`);
