// Lector para tiendas VTEX: recorre la categoría de perfumes de hombre con la API pública de catálogo.
import { get, sleep } from '../http.js';
import { mlOf } from '../normalize.js';

const PAGE = 50, MAX_FROM = 2500;

function walk(nodes, path = [], ids = [], out = []) {
  for (const n of nodes) {
    const p = [...path, n.name], i = [...ids, n.id];
    out.push({ ids: i, path: p, node: n });
    if (n.children?.length) walk(n.children, p, i, out);
  }
  return out;
}

// Categorías de perfumes de hombre: la más alta en el árbol que diga hombre/masculino
// dentro de perfumes/fragancias, sin sets ni cuidado personal.
export function menCategories(tree) {
  const all = walk(tree);
  const ok = c => /perfum|fragan/i.test(c.path[0]) && /hombre|masculin/i.test(c.path.at(-1))
    && !c.path.some(p => /set|kit|estuche|desodor|cuidado|tratamiento|tester/i.test(p));
  const picked = all.filter(ok);
  return picked.filter(c => !picked.some(o => o !== c && c.ids.length > o.ids.length && o.ids.every((id, k) => c.ids[k] === id)));
}

async function searchAll(base, cat, log) {
  const fq = 'C:/' + cat.ids.join('/') + '/';
  const url = (from, to) => `${base}/api/catalog_system/pub/products/search?fq=${encodeURIComponent(fq)}&_from=${from}&_to=${to}`;
  const first = await get(url(0, PAGE - 1), { json: true });
  const total = +(first.headers.get('resources') || '').split('/')[1] || first.body.length;
  if (total > MAX_FROM && cat.node.children?.length) {
    // la API no pagina más allá de 2500: bajamos a las subcategorías
    log(`  ${cat.path.join(' > ')}: ${total} productos, divido por subcategoría`);
    const out = [];
    for (const ch of walk(cat.node.children, cat.path, cat.ids).filter(c => c.ids.length === cat.ids.length + 1)) out.push(...await searchAll(base, ch, log));
    return out;
  }
  const products = [...first.body];
  for (let from = PAGE; from < Math.min(total, MAX_FROM); from += PAGE) {
    await sleep(150);
    const r = await get(url(from, Math.min(from + PAGE, MAX_FROM) - 1), { json: true });
    products.push(...r.body);
  }
  log(`  ${cat.path.join(' > ')}: ${products.length}/${total} productos`);
  return products;
}

export async function scrapeVtex(store, log = console.log) {
  const base = store.url;
  const tree = (await get(`${base}/api/catalog_system/pub/category/tree/4`, { json: true })).body;
  const cats = store.categories || menCategories(tree);
  if (!cats.length) throw new Error('No encontré la categoría de perfumes de hombre');
  const seen = new Set(), rows = [];
  for (const cat of cats) {
    for (const p of await searchAll(base, cat, log)) {
      if (seen.has(p.productId)) continue;
      seen.add(p.productId);
      const link = p.link || `${base}/${p.linkText}/p`;
      const catText = (p.categories || []).join(' ');
      for (const it of p.items || []) {
        const seller = (it.sellers || []).find(s => s.sellerDefault) || (it.sellers || [])[0];
        const o = seller?.commertialOffer || {};
        if (!o.Price) continue;
        rows.push({
          productId: String(p.productId), sku: String(it.itemId),
          title: p.productName, variant: it.name, brand: p.brand,
          ml: mlOf(it.name) || mlOf(it.nameComplete) || mlOf(p.productName),
          price: Math.round(o.Price), list: Math.round(Math.max(o.ListPrice || 0, o.PriceWithoutDiscount || 0, o.Price)),
          stock: (o.AvailableQuantity || 0) > 0, url: link, ean: it.ean || null, category: catText,
          image: it.images?.[0]?.imageUrl || null,
        });
      }
    }
  }
  return rows;
}
