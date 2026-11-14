// Lector para Tiendanube (Ruiz y Roca): listado de categoría + página de cada producto.
import { get, pool, sleep } from '../http.js';
import { mlOf } from '../normalize.js';

const decode = s => s.replace(/&quot;/g, '"').replace(/&#039;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const text = s => decode((s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export async function scrapeTiendanube(store, log = console.log) {
  const base = store.url.replace(/\/$/, '');
  const links = new Set();
  for (let page = 1; page <= 200; page++) {
    const u = page === 1 ? base + store.categoryPath : `${base}${store.categoryPath}page/${page}/`;
    const html = (await get(u)).body;
    const found = [...html.matchAll(/href="([^"]*\/productos\/[^"?#]+)/g)].map(m => m[1].startsWith('http') ? m[1] : base + m[1])
      .map(h => h.replace(/^https?:\/\/(www\.)?/, 'https://www.')).filter(h => !/\/productos\/?$/.test(h));
    const before = links.size;
    found.forEach(h => links.add(h.endsWith('/') ? h : h + '/'));
    if (!found.length || links.size === before) break;
    await sleep(150);
  }
  log(`  listado: ${links.size} productos`);
  const rows = [];
  let fails = 0;
  await pool([...links], 4, async (href) => {
    let html;
    try { html = (await get(href)).body; } catch (e) { fails++; return; }
    const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]).replace(/\.$/, '');
    const dv = html.match(/data-variants="([^"]*)"/);
    if (!h1 || !dv) return;
    let variants;
    try { variants = JSON.parse(decode(dv[1])); } catch { return; }
    // marca: "DIOR - SAUVAGE PARFUM" o el campo brand del JSON de la página
    const brand = (h1.includes(' - ') ? h1.split(' - ')[0] : null) || html.match(/"brand":\s*"([^"]+)"/)?.[1] || '';
    const title = h1.includes(' - ') ? h1.split(' - ').slice(1).join(' - ') : h1;
    const crumbs = [...html.matchAll(/"@type":"ListItem","position":\d+,"name":"([^"]+)"/g)].map(m => m[1]).join(' ');
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1] || null;
    const barcodes = Object.fromEntries([...html.matchAll(/"id":\s*(\d+),\s*"barcode":\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
    for (const v of variants) {
      if (!v.price_number) continue;
      rows.push({
        productId: String(v.product_id), sku: String(v.id), title, variant: [v.option0, v.option1].filter(Boolean).join(' '), brand,
        ml: mlOf(v.option0 || '') || mlOf(v.option1 || '') || mlOf(h1),
        price: Math.round(v.price_number), list: Math.round(Math.max(v.compare_at_price_number || 0, v.price_number)),
        stock: !!v.available && (v.stock === null || v.stock > 0), url: href, ean: barcodes[v.id] || null, category: crumbs,
        image: v.image_url ? (v.image_url.startsWith('//') ? 'https:' + v.image_url : v.image_url).replace(/\\\//g, '/') : ogImage,
      });
    }
  });
  if (fails > links.size * 0.2) throw new Error(`fallaron ${fails} de ${links.size} páginas de producto`);
  return rows;
}
