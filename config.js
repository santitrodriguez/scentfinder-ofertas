// Configuración general de ScentFinder Ofertas.
// Descuento mínimo para que un precio cuente como oferta (0.10 = 10%).
// También se puede cambiar sin tocar el código con la variable de entorno MIN_DISCOUNT=0.15
export const MIN_DISCOUNT = Number(process.env.MIN_DISCOUNT ?? 0.10);

export const MIN_ML = 30;
export const MAX_ML = 200;

// Zona horaria para fechas que se muestran y nombre de los archivos de historial.
export const TZ = 'America/Argentina/Buenos_Aires';

export const STORES = [
  { id: 'juleriaque', name: 'Juleriaque', url: 'https://www.juleriaque.com.ar', platform: 'vtex' },
  { id: 'rouge', name: 'Rouge', url: 'https://www.perfumeriasrouge.com', platform: 'vtex' },
  { id: 'beauty24', name: 'Beauty 24', url: 'https://www.beauty24.com.ar', platform: 'vtex' },
  { id: 'pigmento', name: 'Pigmento', url: 'https://www.perfumeriaspigmento.com.ar', platform: 'vtex' },
  // Parfumerie responde 403 a pedidos que no vienen de un navegador (verificado el 14/11/2026).
  // El lector queda listo por si la tienda habilita el acceso; mientras tanto figura como "sin datos".
  { id: 'parfumerie', name: 'Parfumerie', url: 'https://www.parfumerie.com.ar', platform: 'magento',
    categoryPath: '/fragancias/hombre.html' },
  { id: 'ruizyroca', name: 'Ruiz y Roca', url: 'https://www.ruizyrocaperfumeria.com', platform: 'tiendanube',
    categoryPath: '/fragancias1/masculinas/' },
];

// Si una tienda devuelve menos de esta fracción de los productos del día anterior,
// se considera una lectura fallida y se mantienen los datos anteriores.
export const MIN_COVERAGE = 0.5;
