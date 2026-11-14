// Vuelve a pedirle a cada tienda N ofertas al azar y compara con data/ofertas.json.
// Uso: npm run check            (10 al azar)
//      npm run check -- 25      (25 al azar)
import fs from 'node:fs';
import { STORES } from '../config.js';
import { get } from '../lib/http.js';

const N = +process.argv[2] || 10;
const D = JSON.parse(fs.readFileSync('data/ofertas.json', 'utf8'));
const byId = Object.fromEntries(STORES.map(s => [s.id, s]));
const pick = [...D.offers].sort(() => Math.random() - 0.5).slice(0, N);
const decode = s => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const mlRe = ml => new RegExp('(^|\\D)' + ml + '\\s?ml', 'i');

async function live(o) {
  const s = byId[o.store];
  if (s.platform === 'vtex') {
    const slug = o.url.replace(/^https?:\/\/[^/]+\//, '').replace(/\/p\/?$/, '');
    const [p] = (await get(`${s.url}/api/catalog_system/pub/products/search/${slug}/p`, { json: true })).body;
    const it = p.items.find(i => (o.ean && i.ean === o.ean) || mlRe(o.ml).test(i.name)) || p.items[0];
    const c = (it.sellers.find(x => x.sellerDefault) || it.sellers[0]).commertialOffer;
    return { price: Math.round(c.Price), list: Math.round(Math.max(c.ListPrice, c.PriceWithoutDiscount || 0, c.Price)), stock: c.AvailableQuantity > 0 };
  }
  if (s.platform === 'tiendanube') {
    const html = (await get(o.url)).body;
    const v = JSON.parse(decode(html.match(/data-variants="([^"]*)"/)[1])).find(v => mlRe(o.ml).test(`${v.option0} ${v.option1}`));
    return { price: Math.round(v.price_number), list: Math.round(Math.max(v.compare_at_price_number || 0, v.price_number)), stock: v.available };
  }
  throw new Error('plataforma sin verificación automática');
}

let ok = 0;
for (const o of pick) {
  let res, l;
  try { l = await live(o); res = l.price === o.price && l.list === o.list && l.stock === o.stock; }
  catch (e) { res = null; l = { error: e.message }; }
  if (res) ok++;
  console.log(`${res ? '✔' : res === null ? '?' : '✘'} ${o.brand} ${o.name} ${o.conc || ''} ${o.ml} ml · ${o.store} · guardado $${o.price}/$${o.list} · ahora ${l.error || `$${l.price}/$${l.list}${l.stock ? '' : ' SIN STOCK'}`}`);
  console.log(`   ${o.url}`);
}
console.log(`\nCoinciden ${ok} de ${pick.length}`);
