# ScentFinder Ofertas

Perfumes de hombre en oferta hoy en Juleriaque, Rouge, Beauty 24, Pigmento, Parfumerie y Ruiz y Roca, con el precio de ese mismo frasco en las otras tiendas. Se actualiza solo todos los días a las 7:00 (hora Argentina).

Solo necesita **Node 20 o más nuevo**. No hay que instalar dependencias.

## Correrlo a mano

```bash
npm run scrape     # lee las 6 tiendas -> data/raw/<tienda>.json
npm run build      # cruza tiendas -> data/ofertas.json + history/AAAA-MM-DD.json
npm run serve      # abre la página en http://localhost:8080
npm run check      # compara 10 ofertas al azar contra las tiendas (npm run check -- 25 para 25)
```

`npm run update` hace `scrape` + `build` de una vez. Para leer solo algunas tiendas: `npm run scrape -- rouge pigmento`.

## Cambiar el descuento mínimo

En [config.js](config.js), `MIN_DISCOUNT` (0.10 = 10%). También se puede probar sin tocar el archivo:

```bash
MIN_DISCOUNT=0.2 npm run build
```

Para cambiarlo en la actualización diaria, editá `config.js` y subí el cambio. El rango de tamaños (`MIN_ML`, `MAX_ML`) está en el mismo archivo.

## Promos bancarias (Mi tarjeta)

Las promos se cargan a mano en [data/promos.json](data/promos.json), porque cada tienda las publica distinto (muchas veces como imágenes) y cambian todos los meses. En la página, "Mi tarjeta" muestra el precio final con el reintegro sumado y en qué días y canal aplica.

Para agregar o cambiar una promo, editá ese archivo desde GitHub (lápiz ✏️) copiando una existente:

- `card`: la tarjeta (tiene que estar en `cards`). Para sumar otra tarjeta, agregala a `cards`.
- `store`: `juleriaque`, `rouge`, `beauty24`, `pigmento`, `parfumerie` o `ruizyroca`.
- `type`: `reintegro`, `descuento` o `cuotas`. `pct`: el porcentaje. `tope`: monto máximo de reintegro en $ (`null` = sin tope).
- `days`: `["martes"]`, `["todos"]`, etc. `channel`: `web`, `sucursal` o `ambos`.
- `until`: último día de vigencia (AAAA-MM-DD). Pasada esa fecha deja de mostrarse sola.

Al guardar el cambio, la página se republica sola en unos minutos.

### Aviso automático de promos nuevas

Todos los días, junto con la actualización de precios, `npm run watch-promos` lee las páginas de promos bancarias de las tiendas y guarda en `data/promo-watch.json` todo lo que dicen de **Galicia / Éminent** (incluida la vigencia de los legales). Si algo cambia (una promo nueva, una que se renueva o una que desaparece), se crea un **Issue** en el repo con el detalle y GitHub te lo manda por mail. Con eso actualizás `data/promos.json` (o se lo pedís a Claude).

- Lee bien Juleriaque, Rouge, Beauty 24 y Ruiz y Roca.
- **Pigmento** arma sus promos con imágenes que se cargan después: solo se detecta si Galicia aparece en el texto de la página.
- **Parfumerie** bloquea las lecturas automáticas: hay que revisarla a mano en https://www.parfumerie.com.ar/metodos-de-pago.
- Para cambiar de tarjeta o banco, editá `WATCH` al principio de `scripts/watch-promos.js`.
- Para ver cómo llega el aviso: **Actions › Actualizar ofertas › Run workflow** y tildá "Crear un aviso de prueba".

## Publicación automática (GitHub Actions + Pages)

1. Subí esta carpeta a un repositorio de GitHub (rama `main`).
2. En el repo: **Settings › Pages › Build and deployment › Source: GitHub Actions**.
3. En **Actions › Actualizar ofertas › Run workflow** corrés la primera actualización a mano.

Después corre solo todos los días a las 10:00 UTC (7:00 en Argentina). Cada corrida lee las tiendas, guarda `data/` y `history/` en el repo y publica la página. GitHub puede demorar los cron unos minutos.

## Cómo funciona

- **Lectores** (`lib/stores/`): VTEX usa la API pública de catálogo y recorre la categoría de hombre completa. Tiendanube (Ruiz y Roca) lee el listado y después cada página de producto (`data-variants` + código de barras). Magento (Parfumerie) lee el listado y la página de producto (`optionPrices` o metadatos).
- **Oferta**: precio al menos `MIN_DISCOUNT` por debajo del precio de lista de la misma tienda, con stock, entre 30 y 200 ml, sin sets, kits, testers, desodorantes, geles, recargas, miniaturas ni combos.
- **Mismo frasco entre tiendas**: mismo EAN y, si no, misma marca + nombre + concentración + ml (sin acentos, mayúsculas ni palabras de relleno: "D By Diesel Red" = "D Red").
- **Ahorro** = tienda más cara con stock − precio de la oferta. Lo que no tiene stock se ve en gris y no cuenta.
- **Historial**: `history/AAAA-MM-DD.json` guarda una foto compacta de precios por día, que se usa para "días en oferta" y "precio más bajo visto".
- **Si una tienda falla** (o devuelve menos de la mitad de productos que el día anterior), se mantienen sus datos anteriores y la página muestra de qué fecha son.

## Limitaciones conocidas

- **Parfumerie** responde 403 a cualquier pedido que no venga de un navegador. El lector está escrito pero no se pudo probar; mientras tanto la tienda figura como "sin datos". Si la tienda habilita el acceso, revisá `categoryPath` en `config.js`.
- Las promos bancarias se cargan a mano (ver arriba). No se incluyen descuentos por transferencia.
- Rouge y Beauty 24 comparten catálogo: sus ofertas aparecen duplicadas, una por tienda.
