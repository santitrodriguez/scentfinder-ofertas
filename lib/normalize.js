// Normalización de nombres, marcas, concentraciones y tamaños.
// Las reglas base (norm, conc, mlOf, exclusiones) vienen de scraper.js.

export const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[´`'’]/g, ' ').replace(/[-–|.,:;()/\\_*"!¡]/g, ' ').replace(/\s+/g, ' ').trim();

const esc = t => t.replace(/[.*+?^${}()|[\]\\&]/g, '\\$&');
export const has = (n, t) => new RegExp('(^|[^a-z0-9])' + esc(t) + '($|[^a-z0-9])').test(n);

// Palabras que hacen que un producto no sea un perfume individual.
const EXCLUDE = ['set', 'sets', 'kit', 'estuche', 'coffret', 'tester', 'testers', 'probador', 'deo', 'desodorante',
  'deodorant', 'antitranspirante', 'gel', 'shower', 'shampoo', 'after shave', 'aftershave', 'balm', 'body', 'locion corporal',
  'mini', 'travel', 'recarga', 'refill', 'vial', 'sample', 'muestra', 'miniatura', 'pack', 'combo', 'bolso',
  'bag', 'llavero', 'neceser', 'botella', 'termica', 'jabon', 'crema', 'hair', 'capilar', 'splash', 'stick', 'pouch'];

export function isExcluded(title) {
  const n = norm(title);
  if ((title || '').includes('+')) return true;
  return EXCLUDE.some(t => has(n, t));
}

export function conc(text) {
  const n = norm(text);
  if (/elixir/.test(n)) return 'Elixir';
  if (/\bedpi?\b|eau de parfum|eau parfum|\bedp\d/.test(n)) return 'EDP';
  if (/\bedt\b|eau de toilette|toilette/.test(n)) return 'EDT';
  if (/\bparfum\b|\bextrait\b|\bperfume puro\b/.test(n)) return 'Parfum';
  if (/cologne|colonia|\bedc\b/.test(n)) return 'EDC';
  return null;
}

export const mlOf = s => {
  const m = norm(s).match(/(\d{2,3})\s?ml\b/) || norm(s).match(/\bx\s?(\d{2,3})\b/);
  return m ? +m[1] : null;
};

// Marcas con varias formas de escribirse -> forma canónica para comparar.
const BRAND_ALIAS = [
  [/^(christian )?dior$/, 'dior'],
  [/^(giorgio |emporio )?armani( beauty)?$/, 'armani'],
  [/^(paco )?rabanne$/, 'rabanne'],
  [/^(yves )?saint laurent$|^ysl$/, 'ysl'],
  [/^jean paul gaultier$|^jpg$|^gaultier$/, 'jean paul gaultier'],
  [/^dolce (&|y|and )?\s?gabbana$|^d ?& ?g$|^dolce gabbana$/, 'dolce gabbana'],
  [/^(hugo )?boss$|^hugo boss$/, 'boss'],
  [/^calvin klein$|^ck$/, 'calvin klein'],
  [/^mont ?blanc$/, 'montblanc'],
  [/^carolina herrera$|^ch$/, 'carolina herrera'],
  [/^ralph lauren$|^polo ralph lauren$/, 'ralph lauren'],
  [/^hermes( paris)?$/, 'hermes'],
  [/^chanel( paris)?$/, 'chanel'],
  [/^tommy hilfiger$|^tommy$/, 'tommy hilfiger'],
  [/^lattafa( perfumes)?$/, 'lattafa'],
  [/^maison francis kurkdjian$|^mfk$/, 'maison francis kurkdjian'],
];
export function brandKey(brand) {
  const b = norm(brand).replace(/&/g, ' & ').replace(/\s+/g, ' ').trim();
  for (const [re, k] of BRAND_ALIAS) if (re.test(b)) return k;
  return b;
}
// Palabras de la marca que se quitan del nombre (incluye alias).
function brandWords(brand) {
  const k = brandKey(brand);
  const extra = { dior: ['christian dior', 'dior'], armani: ['giorgio armani', 'emporio armani', 'armani'],
    rabanne: ['paco rabanne', 'rabanne'], ysl: ['yves saint laurent', 'saint laurent', 'ysl'],
    'jean paul gaultier': ['jean paul gaultier', 'gaultier', 'jpg'], 'dolce gabbana': ['dolce&gabbana', 'dolce & gabbana', 'dolce and gabbana', 'dolce y gabbana', 'dolce gabbana', 'd&g'],
    boss: ['hugo boss', 'boss'], 'calvin klein': ['calvin klein'], montblanc: ['montblanc', 'mont blanc'] };
  return [...new Set([...(extra[k] || []), norm(brand), k])].filter(Boolean).sort((a, b) => b.length - a.length);
}

// Frases que no identifican al perfume (concentración, tamaño, género, envase).
const NOISE = ['eau de toilette', 'eau de parfum', 'eau parfum', 'eau de cologne', 'eau fraiche', 'edt', 'edp', 'edc',
  'perfume', 'perfumes', 'fragancia', 'fragance', 'fragrance', 'para hombre', 'hombre', 'masculino', 'masculina',
  'pour homme', 'for men', 'men', 'man', 'uomo', 'spray', 'vaporizador', 'vapo', 'natural', 'nuevo', 'nueva', 'new',
  'recargable', 'refillable', 'rellenable', 'edicion limitada', 'limited edition', 'edition', 'edicion', 'ml', 'x', 'by',
  'the', 'de', 'del', 'la', 'el', 'en', 'y', 'and', 'con', 'original', 'premium'];

// Tokens que identifican al perfume (sin marca, sin concentración, sin tamaño).
export function nameTokens(title, brand) {
  let n = ' ' + norm(title).replace(/&/g, ' & ') + ' ';
  for (const w of brandWords(brand)) n = n.replace(new RegExp(' ' + esc(w) + '(?= )', 'g'), ' ');
  n = n.replace(/ edpi(?= )/g, ' intense ');
  n = n.replace(/\b\d{2,3}\s?ml\b/g, ' ').replace(/\bx\s?\d{2,3}\b/g, ' ').replace(/\b\d{2,3}\b/g, m => (+m >= 30 && +m <= 200 ? ' ' : m));
  // "elixir", "parfum" y "extrait" quedan en la concentración; los quitamos del nombre
  n = n.replace(/ (le |l )?(parfum|extrait|elixir)(?= )/g, ' ');
  for (const w of NOISE) n = n.replace(new RegExp(' ' + esc(w) + '(?= )', 'g'), ' ');
  // "Y" de YSL y "D" de Diesel son nombres de perfume, no conectores: los cuidamos arriba
  // quitando "y" solo como conector. Si el nombre queda vacío, usamos el título completo.
  const toks = n.split(' ').filter(Boolean).filter(t => t !== '&');
  return toks;
}

export function nameKey(title, brand) {
  let toks = nameTokens(title, brand);
  if (!toks.length) {
    // ej. "YSL Y EDP": la "y" se quitó como conector -> recuperarla
    const n = norm(title);
    if (/(^|\s)y(\s|$)/.test(n.replace(/yves saint laurent|saint laurent|ysl/g, ' '))) toks = ['y'];
  }
  return [...new Set(toks)].sort().join(' ');
}

// Nombre para mostrar: título original sin marca, concentración ni tamaño.
export function displayName(title, brand) {
  let s = ' ' + (title || '').replace(/\s+/g, ' ') + ' ';
  const words = brandWords(brand).concat([brand || '']).filter(Boolean);
  // "K by Dolce&Gabbana" -> "K", "D By Diesel Red" -> "D Red"
  for (const w of words) s = s.replace(new RegExp('\\sby\\s+' + esc(w) + '(?=[\\s\\-–|.,]|$)', 'ig'), ' ');
  for (const w of words.sort((a, b) => b.length - a.length)) {
    // no se quita si es parte del nombre: "Bleu de Chanel", "Terre d'Hermès"
    s = s.replace(new RegExp('(^|[\\s\\-–|])(?<!\\bde\\s|\\bdu\\s|\\bdi\\s)' + esc(w) + '(?=[\\s\\-–|.,]|$)', 'ig'), (m, sep) => sep + ' ');
  }
  s = s.replace(/\bEDPI\b/g, 'Intense');
  s = s.replace(/eau de (toilette|parfum|cologne)|\b(edt|edp|edc)\b|\bperfumes? (para |de )?hombre\b|\bpara hombre\b|\bperfume\b|\bfragancia\b|\bx?\s?\d{2,3}\s?ml\b|\bx\s?\d{2,3}\b|\bvaporizador\b|\bspray\b|\brecargable\b|\brefillable\b|\bnuev[oa]\b|\bnew\b/ig, ' ');
  s = s.replace(/\s[-–|]\s/g, ' ').replace(/^[\s\-–|.,]+|[\s\-–|.,]+$/g, '').replace(/\s+/g, ' ').trim();
  if (s && s === s.toUpperCase()) s = titleCase(s);
  return s || (title || '').trim();
}

export function titleCase(s) {
  const small = new Set(['de', 'di', 'du', 'la', 'le', 'by', 'pour', 'for', 'of', 'the', 'y', 'et', 'in', 'del', 'el']);
  return (s || '').toLowerCase().split(' ').map((w, i) => {
    if (i > 0 && small.has(w)) return w;
    if (/^(edt|edp|edc|vip|nyc|ck|ysl|jpg|d&g|ii|iii|iv)$/.test(w)) return w.toUpperCase();
    return w.charAt(0).toUpperCase() + w.slice(1).replace(/&(\w)/g, (m, c) => '&' + c.toUpperCase());
  }).join(' ').replace(/\b(L|D)´|\b(L|D)'/g, m => m.toUpperCase());
}

export function brandDisplay(brand) {
  if (!brand) return '';
  return brand === brand.toUpperCase() ? titleCase(brand) : brand.trim();
}

export function cleanEan(e) {
  const s = String(e || '').replace(/\D/g, '').replace(/^0+/, '');
  if (s.length < 8 || /^(\d)\1+$/.test(s)) return null;
  return s;
}
