// Tipo de perfume según la marca. Cualquier marca que no esté acá cuenta como "disenador".
// Para cambiar una marca de tipo, agregala (en minúsculas, sin acentos) a la lista que corresponda.
import { brandKey, norm } from './normalize.js';

export const CATEGORIES = {
  arabe: 'Árabes',
  nicho: 'Nicho',
  disenador: 'Diseñador',
  catalogo: 'Catálogo',
};

const ARABE = [
  'lattafa', 'armaf', 'afnan', 'rasasi', 'al haramain', 'maison alhambra', 'french avenue', 'hamidi', 'nusuk',
  'fariis', 'riiffs', 'al shams', 'al wataniah', 'anbar', 'arabes', 'ard al zaafaran', 'fragrance world', 'paris corner',
  'rayhaan', 'zimaya', 'khadlaj', 'swiss arabian', 'ajmal', 'nabeel', 'asdaaf', 'orientica', 'emper', 'arabiyat',
  'bravura', 'gulf orchid', 'ahmed al maghribi', 'al rehab', 'maison asrar', 'dumont',
];

const NICHO = [
  'creed', 'parfums de marly', 'maison francis kurkdjian', 'xerjoff', 'amouage', 'initio', 'nishane', 'byredo', 'le labo',
  'diptyque', 'acqua di parma', 'penhaligon s', 'kilian', 'by kilian', 'memo paris', 'mancera', 'montale',
  'juliette has a gun', 'frederic malle', 'escentric molecules', 'floris', 'clive christian', 'roja parfums',
  'bond no 9', 'ex nihilo', 'goldfield banks', 'eight bob', 'tiziana terenzi', 'nasomatto', 'orto parisi', 'sospiro',
  'atelier cologne', 'maison crivelli', 'boadicea the victorious', 'histoires de parfums',
];

// Masivos, económicos, celebridades y marcas nacionales
const CATALOGO = [
  'banderas', 'antonio banderas', 'david beckham', 'adidas', 'benetton', 'united colors of benetton', 'nautica',
  'halloween', 'jeanne arthes', 'jeanne arthes paris', 'jeanne en provence', 'ted lapidus', 'jacques bogart',
  'pino silvestre', 'molyneux', 'police', 'pepe jeans', 'replay', 'bmw', 'mercedes benz', 'head', 'victorinox',
  'milton lloyd', 'chester ice', 'kevingston', 'kevin', 'mc taylor', 'giesso', 'bensimon', 'boos', 'gino bogani',
  'carlos benaim', 'cardon', 'la dolfina', 'la martina', 'wellington polo club', 'sarkany', 'pacha', 'tascani',
  'burgues', 'bross', 'l inedito', 'quartz', 'julien', 'colbert', 'acqua di colbert', 'vertiente',
  'acqua di vertiente', 'arex', 'altai', 'rouge', 'inactivos perfumeria', 'shakira', 'antonio banderas',
  'paris hilton', 'britney spears', 'jennifer lopez', 'ricky martin', 'alejandro sanz', 'reef', 'rip curl', 'tascani',
];

const sets = Object.fromEntries(Object.entries({ arabe: ARABE, nicho: NICHO, catalogo: CATALOGO })
  .map(([k, list]) => [k, new Set(list.map(b => brandKey(b)))]));

export function categoryOf(brand, title = '') {
  const k = brandKey(brand);
  for (const [cat, set] of Object.entries(sets)) if (set.has(k)) return cat;
  // por si la tienda pone la marca dentro del nombre (ej. marca "ARABES" con "LATTAFA ..." en el título)
  const t = norm(title);
  if ([...sets.arabe].some(b => b.length > 4 && t.includes(b))) return 'arabe';
  return 'disenador';
}
