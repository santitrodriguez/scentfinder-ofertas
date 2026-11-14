// Lector para Magento con tema Hyvä (Parfumerie): listado de categoría + página de producto.
// OJO: no se pudo probar porque la tienda responde 403 a pedidos automáticos (14/11/2026).
import { get, pool, sleep } from '../http.js';
import { mlOf } from '../normalize.js';

const decode = s => s.replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&');
const text = s => decode((s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

function grab(s, key) {
  const i = s.indexOf('"' + key + '":'); if (i < 0) return null;
  const k = s.indexOf('{', i); let dep = 0;
  for (let q = k; q < s.length; q++) {
    if (s[q] === '{') dep++;
    else if (s[q] === '}' && !--dep) { try { return JSON.parse(s.slice(k, q + 1)); } catch { return null; } }
  }
  return null;
}

export async function scrapeMagento(store, log = console.log) {
  const base = store.url.replace(/\/$/, '');
  const links = new Set();
  for (let page = 1; page <= 100; page++) {
    const html = (await get(`${base}${store.categoryPath}?p=${page}&product_list_limit=48`)).body;
    const before = links.size;
    for (const m of html.matchAll(/class="[^"]*product-item[^"]*"[\s\S]*?href="([^"?#]+)"/g)) links.add(m[1]);
    if (links.size === before) break;
    await sleep(200);
  }
  log(`  listado: ${links.size} productos`);
  const rows = [];
  await pool([...links], 3, async (href) => {
    const html = (await get(href)).body;
    const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]);
    const brand = html.match(/"brand":\s*\{[^}]*"name":\s*"([^"]+)"/)?.[1] || html.match(/<meta property="product:brand" content="([^"]+)"/)?.[1] || '';
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null;
    const cfgAttr = [...html.matchAll(/="([^"]*&quot;optionPrices&quot;[^"]*)"/g)][0]?.[1];
    const cfg = cfgAttr ? decode(cfgAttr) : (html.includes('"optionPrices"') ? html : null);
    if (cfg) {
      const op = grab(cfg, 'optionPrices') || {}, at = grab(cfg, 'attributes') || {}, dyn = grab(cfg, 'dynamic') || {};
      for (const a of Object.values(at)) for (const o of a.options || []) for (const pid of o.products || []) {
        const pr = op[pid]; if (!pr) continue;
        const qty = dyn.stock?.[pid]?.qty;
        rows.push({ productId: href, sku: String(pid), title: h1, variant: o.label, brand, ml: mlOf(o.label) || mlOf(h1),
          price: Math.round(pr.finalPrice.amount), list: Math.round(Math.max(pr.oldPrice?.amount || 0, pr.finalPrice.amount)),
          stock: qty === undefined ? true : qty > 0, url: href, ean: null, category: '', image });
      }
    } else {
      // producto simple: el precio real está en los metadatos (no en [data-price-amount], que es de recomendados)
      const fp = +html.match(/<meta property="product:price:amount" content="([\d.]+)"/)?.[1];
      const av = html.match(/<meta property="product:availability" content="([^"]+)"/)?.[1] || '';
      const old = +html.match(/"oldPrice":\s*\{\s*"amount":\s*([\d.]+)/)?.[1] || fp;
      if (fp) rows.push({ productId: href, sku: href, title: h1, variant: '', brand, ml: mlOf(h1) || mlOf(href),
        price: Math.round(fp), list: Math.round(Math.max(old, fp)), stock: /in ?stock/i.test(av), url: href, ean: null, category: '', image });
    }
  });
  return rows;
}
