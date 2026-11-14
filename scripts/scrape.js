// Lee los precios de cada tienda y guarda data/raw/<tienda>.json.
// Uso: npm run scrape            (todas)
//      npm run scrape -- rouge   (solo algunas)
import fs from 'node:fs';
import { STORES, MIN_COVERAGE } from '../config.js';
import { scrapeVtex } from '../lib/stores/vtex.js';
import { scrapeTiendanube } from '../lib/stores/tiendanube.js';
import { scrapeMagento } from '../lib/stores/magento.js';

const READERS = { vtex: scrapeVtex, tiendanube: scrapeTiendanube, magento: scrapeMagento };
const only = process.argv.slice(2);
const stores = STORES.filter(s => !only.length || only.includes(s.id));
fs.mkdirSync('data/raw', { recursive: true });
const statusFile = 'data/raw/_status.json';
const status = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf8')) : {};

await Promise.all(stores.map(async store => {
  const t0 = Date.now();
  const log = m => console.log(`[${store.id}] ${m}`);
  const file = `data/raw/${store.id}.json`;
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  try {
    log('leyendo…');
    const rows = await READERS[store.platform](store, log);
    if (!rows.length) throw new Error('no devolvió productos');
    if (prev && rows.length < prev.rows.length * MIN_COVERAGE)
      throw new Error(`lectura incompleta: ${rows.length} filas contra ${prev.rows.length} del día anterior`);
    // una fila por línea: así git guarda solo lo que cambió de un día a otro
    fs.writeFileSync(file, `{"store":${JSON.stringify(store.id)},"readAt":${JSON.stringify(new Date().toISOString())},"rows":[\n${rows.map(r => JSON.stringify(r)).join(',\n')}\n]}\n`);
    status[store.id] = { ok: true, lastAttempt: new Date().toISOString(), rows: rows.length, seconds: Math.round((Date.now() - t0) / 1000) };
    log(`ok: ${rows.length} variantes en ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (e) {
    status[store.id] = { ok: false, lastAttempt: new Date().toISOString(), error: String(e.message || e).slice(0, 300) };
    log(`FALLÓ: ${e.message}${prev ? ` (se mantienen los datos de ${prev.readAt})` : ' (sin datos anteriores)'}`);
  }
}));
fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
