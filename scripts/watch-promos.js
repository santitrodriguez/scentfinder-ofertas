// Vigila las páginas de promos bancarias de cada tienda y detecta cambios en lo que dicen
// de la tarjeta configurada (por defecto Galicia / Éminent).
// Guarda la última foto en data/promo-watch.json y, si algo cambió, escribe un resumen en
// promo-changes.md (el workflow diario lo publica como Issue en GitHub, que te llega por mail).
// Uso: npm run watch-promos
import fs from 'node:fs';
import { get } from '../lib/http.js';

const WATCH = /galicia|[ée]minent/i;
const SOURCES = [
  { store: 'Juleriaque', url: 'https://www.juleriaque.com.ar/beneficios', parse: juleriaque },
  { store: 'Rouge', url: 'https://www.perfumeriasrouge.com/ayuda/medios-pagos' },
  { store: 'Beauty 24', url: 'https://www.beauty24.com.ar/ayuda/medios-pagos' },
  { store: 'Pigmento', url: 'https://www.perfumeriaspigmento.com.ar/promociones-bancarias' },
  { store: 'Ruiz y Roca', url: 'https://www.ruizyrocaperfumeria.com/promocionesbancarias' },
  { store: 'Parfumerie', url: 'https://www.parfumerie.com.ar/metodos-de-pago' },
];
const FILE = 'data/promo-watch.json';
const OUT = 'promo-changes.md';

// HTML (a veces escapado dentro de JSON) -> líneas de texto
function toLines(html) {
  let s = html
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\"/g, '"').replace(/\\\//g, '/');
  s = s.replace(/<script\b[^>]*type="application\/ld\+json"[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/h\d|\/div|\/li|\/span|\/button|\/a)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ');
  return s.split('\n').map(l => l.replace(/\s+/g, ' ').trim())
    // fuera código suelto, URLs y textos muy largos (scripts) o vacíos
    .filter(l => l && l.length < 400 && !/[{};=]\s*\S*[{};=]/.test(l) && !/^https?:/.test(l));
}

// Bloques de texto alrededor de cada mención de la tarjeta (incluye vigencia y condiciones).
// Menciones cercanas se juntan en un solo bloque para no repetir.
function blocks(lines) {
  const hits = [];
  lines.forEach((l, i) => { if (WATCH.test(l)) hits.push(i); });
  const groups = [];
  for (const i of hits) {
    const g = groups.at(-1);
    if (g && i - g.end <= 8) g.end = i; else groups.push({ start: i, end: i });
  }
  const out = new Set();
  for (const g of groups) {
    const b = lines.slice(Math.max(0, g.start - 3), g.end + 12)
      .filter(l => !/document\.|function|=>|^\}|^\{/.test(l)).join(' · ');
    if (/%|cuota|reintegro|descuento|off/i.test(b)) out.add(b.slice(0, 1200));
  }
  return [...out].sort();
}

// Juleriaque guarda cada beneficio como una tarjeta: logo del banco (texto alternativo) + textos + condiciones
function juleriaque(html) {
  const unesc = x => x.replace(/\\+n/g, ' ').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
  const out = new Set();
  for (const chunk of html.split('{"infocardImage"').slice(1)) {
    const alt = chunk.match(/"imgDesktopAlt":"([^"]*)"/)?.[1] || '';
    const overlay = chunk.match(/"overlayText":"((?:[^"\\]|\\.)*)"/)?.[1] || '';
    if (!WATCH.test(alt + ' ' + overlay)) continue;
    const texts = [...chunk.matchAll(/"textContent":"((?:[^"\\]|\\.)*)"/g)].map(m => unesc(m[1]));
    out.add([alt, ...texts, unesc(overlay)].filter(Boolean).join(' · ').slice(0, 1200));
  }
  return [...out].sort();
}

const prev = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const next = {};
const changes = [];
for (const src of SOURCES) {
  try {
    const html = (await get(src.url)).body;
    const b = src.parse ? src.parse(html) : blocks(toLines(html));
    next[src.store] = { url: src.url, checkedAt: new Date().toISOString(), blocks: b };
    const old = prev[src.store]?.blocks;
    if (!old) { console.log(`[${src.store}] primera lectura: ${b.length} menciones`); continue; }
    const added = b.filter(x => !old.includes(x)), removed = old.filter(x => !b.includes(x));
    if (added.length || removed.length) changes.push({ ...src, added, removed });
    console.log(`[${src.store}] ${b.length} menciones · ${added.length} nuevas · ${removed.length} quitadas`);
  } catch (e) {
    next[src.store] = { ...(prev[src.store] || {}), url: src.url, error: String(e.message).slice(0, 200), failedAt: new Date().toISOString() };
    console.log(`[${src.store}] no se pudo leer: ${e.message}`);
  }
}
fs.writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');

if (fs.existsSync(OUT)) fs.unlinkSync(OUT);
if (changes.length) {
  const md = [`Cambiaron las promos con **Galicia / Éminent** en ${changes.map(c => c.store).join(', ')}.`, '',
    'Revisá los legales en la página de la tienda y, si corresponde, actualizá `data/promos.json` (o pedile a Claude que lo haga).', ''];
  for (const c of changes) {
    md.push(`### ${c.store}`, c.url, '');
    if (c.added.length) md.push('**Nuevo o modificado:**', ...c.added.map(x => `- ${x}`), '');
    if (c.removed.length) md.push('**Ya no aparece:**', ...c.removed.map(x => `- ${x}`), '');
  }
  fs.writeFileSync(OUT, md.join('\n'));
  console.log(`\nHay cambios: ${OUT}`);
} else console.log('\nSin cambios en las promos con Galicia / Éminent.');
