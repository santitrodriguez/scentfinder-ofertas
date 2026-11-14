(() => {
  'use strict';
  const TZ = 'America/Argentina/Buenos_Aires';
  const PAGE = 60;
  const app = document.getElementById('app');
  let D = null;
  const S = { q: '', store: 'all', min: 0, size: 'all', sort: 'pct', shown: PAGE };

  // ---------- utilidades ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$ ' + Math.round(n).toLocaleString('es-AR');
  const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const parts = (iso, opts) => new Intl.DateTimeFormat('es-AR', { timeZone: TZ, ...opts }).format(new Date(iso));
  const dm = iso => parts(iso, { day: '2-digit', month: '2-digit' });
  const hm = iso => parts(iso, { hour: '2-digit', minute: '2-digit', hour12: false });
  const ymd = iso => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso));
  const dmFromYmd = d => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '';
  const todayYmd = () => ymd(new Date());
  const whenLabel = iso => {
    if (!iso) return 'sin datos';
    const d = ymd(iso), t = todayYmd();
    const y = ymd(new Date(Date.now() - 864e5));
    return d === t ? `hoy, ${dm(iso)} · ${hm(iso)}` : d === y ? `ayer, ${dm(iso)} · ${hm(iso)}` : `${dm(iso)} · ${hm(iso)}`;
  };
  const relDay = iso => { const d = ymd(iso); return d === todayYmd() ? 'hoy, ' : d === ymd(new Date(Date.now() - 864e5)) ? 'ayer, ' : 'el '; };
  const storeName = id => D.stores.find(s => s.id === id)?.name || id;
  const storeMeta = id => D.stores.find(s => s.id === id);
  const isStale = id => { const m = storeMeta(id); return m && m.lastRead && ymd(m.lastRead) !== ymd(D.generatedAt); };
  const LOGO = '<svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><rect x="9" y="1.5" width="8" height="5" rx="1.2" fill="currentColor"/><rect x="11.5" y="6" width="3" height="3" fill="currentColor"/><rect x="4" y="9" width="18" height="15.5" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 17.5h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  // Foto del perfume; si no carga, queda un frasco dibujado en su lugar
  const thumb = (src, alt, cls = 'thumb') => `<span class="${cls}">${src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}${LOGO}</span>`;
  const SIZES = [['all', 'Todos'], ['s', 'Hasta 60 ml'], ['m', '75–125 ml'], ['l', '150 ml o más']];
  const inSize = (ml, k) => k === 'all' || (k === 's' ? ml <= 60 : k === 'm' ? ml > 60 && ml < 150 : ml >= 150);
  const DISC = [[0, 'Todos'], [20, '20% o más'], [30, '30% o más'], [40, '40% o más']];
  const SORTS = [['pct', 'Mayor descuento'], ['price', 'Menor precio'], ['save', 'Mayor ahorro en $'], ['brand', 'Marca A–Z']];

  // ---------- datos ----------
  async function load() {
    try {
      const r = await fetch('data/ofertas.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      D = await r.json();
      for (const o of D.offers) o._q = fold(`${o.brand} ${o.name} ${o.conc || ''} ${o.ml}ml ${storeName(o.store)}`);
      route();
    } catch (e) {
      app.innerHTML = '<p class="empty">No se pudieron cargar las ofertas. Probá recargar la página en unos minutos.</p>';
    }
  }

  function filtered() {
    const words = fold(S.q).split(/\s+/).filter(Boolean);
    const list = D.offers.filter(o =>
      (S.store === 'all' || o.store === S.store) && o.pct >= S.min && inSize(o.ml, S.size) &&
      words.every(w => o._q.includes(w)));
    const by = {
      pct: (a, b) => b.pct - a.pct || a.price - b.price,
      price: (a, b) => a.price - b.price || b.pct - a.pct,
      save: (a, b) => b.save - a.save || b.pct - a.pct,
      brand: (a, b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es') || a.ml - b.ml || a.price - b.price,
    }[S.sort];
    return list.sort(by);
  }

  // ---------- home ----------
  function header() {
    const stores = D.stores.length;
    return `
    <header class="top">
      <div class="top-l">
        <a class="logo" href="#/">${LOGO}<span>ScentFinder</span></a>
        <h1 class="hero">Perfumes de hombre en oferta hoy</h1>
        <p class="lede">Solo perfumes con precio promocional y stock. Para cada uno te mostramos cuánto sale en las otras perfumerías.</p>
      </div>
      <div class="top-r">
        <span><span class="long">Actualizado ${relDay(D.generatedAt)}</span>${dm(D.generatedAt)} · ${hm(D.generatedAt)}</span>
        <span class="count"><b>${D.count.toLocaleString('es-AR')} ofertas</b> en ${stores} perfumerías</span>
        <a class="how" href="#/como-funciona">Cómo funciona</a>
      </div>
    </header>
    ${storeNotice()}`;
  }

  function storeNotice() {
    const issues = D.stores.filter(s => !s.lastRead || isStale(s.id));
    if (!issues.length) return '';
    return `<div class="notice" role="status">${issues.map(s => s.lastRead
      ? `<span><b>${esc(s.name)}</b>: precios del ${dm(s.lastRead)} (hoy no se pudo leer)</span>`
      : `<span><b>${esc(s.name)}</b>: sin datos por ahora (la tienda no permite la lectura automática)</span>`).join('')}</div>`;
  }

  function chips(list, cur, key) {
    return list.map(([v, t]) => `<button type="button" class="chip" data-k="${key}" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(t)}</button>`).join('');
  }

  function renderHome() {
    document.title = 'ScentFinder · Ofertas de perfumes de hombre';
    app.className = 'wrap';
    const storeList = [['all', 'Todas'], ...D.stores.map(s => [s.id, s.name])];
    app.innerHTML = `
    ${header()}
    <section class="filters" aria-label="Filtros">
      <div class="row search">
        <label for="buscar" class="sr">Buscar perfume o marca</label>
        <input id="buscar" type="search" placeholder="Buscar perfume o marca" value="${esc(S.q)}" autocomplete="off">
        <div class="sort">
          <label for="orden">Ordenar por</label>
          <select id="orden">${SORTS.map(([v, t]) => `<option value="${v}"${S.sort === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row chips" role="group" aria-label="Tienda"><span class="lbl">Tienda</span>${chips(storeList, S.store, 'store')}</div>
      <div class="row chips" role="group" aria-label="Descuento y tamaño">
        <span class="lbl">Descuento</span>${chips(DISC, S.min, 'min')}
        <span class="sep" aria-hidden="true"></span>
        <span class="lbl">Tamaño</span>${chips(SIZES, S.size, 'size')}
      </div>
    </section>
    <p class="sr" id="resumen" aria-live="polite"></p>
    <section class="grid" id="grid" aria-label="Ofertas"></section>
    <div id="after"></div>
    <footer class="foot">Una oferta es un precio al menos ${Math.round(D.minDiscount * 100)}% por debajo del precio de lista de la propia tienda, con stock. El ahorro se calcula contra la tienda más cara que lo tiene en stock. La compra se hace en cada tienda: confirmá ahí precio, tamaño y promociones bancarias antes de pagar. <a href="#/como-funciona">Cómo funciona</a>.</footer>`;

    const q = document.getElementById('buscar');
    let t;
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { S.q = q.value; S.shown = PAGE; renderGrid(); }, 120); });
    document.getElementById('orden').addEventListener('change', e => { S.sort = e.target.value; S.shown = PAGE; renderGrid(); });
    app.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k; S[k] = k === 'min' ? +b.dataset.v : b.dataset.v; S.shown = PAGE;
      app.querySelectorAll(`.chip[data-k="${k}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderGrid();
    }));
    renderGrid();
  }

  function card(o) {
    const others = o.others.slice(0, 5);
    const cheaper = o.others.filter(x => x.stock && x.price < o.price).sort((a, b) => a.price - b.price)[0];
    let save;
    if (cheaper) save = `<div class="save alt"><span>Más barato en <b>${esc(storeName(cheaper.store))}</b>: <b>${money(cheaper.price)}</b></span><span class="go">Comparar →</span></div>`;
    else if (o.save > 0) save = `<div class="save"><span>Ahorrás <b>${money(o.save)}</b> <span class="vs-long">vs. la más cara</span><span class="vs-short">vs. ${esc(storeName(o.saveVs))}</span></span><span class="go">Comparar →</span></div>`;
    else if (o.others.some(x => x.stock)) save = `<div class="save"><span>Mismo precio en otras tiendas</span><span class="go">Comparar →</span></div>`;
    else save = `<div class="save"><span>Solo esta tienda lo tiene con stock</span><span class="go">Ver ficha →</span></div>`;
    const stale = isStale(o.store) ? `<span class="stale">Precio del ${dmFromYmd(o.date)}</span>` : `<span class="perml">${money(o.price / o.ml)} por ml</span>`;
    return `
    <a class="card" href="#/p/${encodeURIComponent(o.productId)}/${o.ml}">
      <div class="c-head">
        ${thumb(o.image, `${o.brand} ${o.name}`)}
        <div class="c-id">
          <span class="brand">${esc(o.brand)}</span>
          <span class="pname">${esc(o.name)}</span>
          <span class="spec">${esc(o.conc || 'Fragancia')} · ${o.ml} ml</span>
        </div>
        <span class="pct">−${o.pct}%</span>
      </div>
      <div class="prices"><span class="price">${money(o.price)}</span><s class="was">${money(o.list)}</s></div>
      <div class="where"><span>en <b>${esc(storeName(o.store))}</b></span>${stale}</div>
      <div class="others">
        <span class="lbl">En otras tiendas</span>
        ${others.length ? others.map(x => `<div class="o-row${x.stock ? '' : ' out'}"><span>${esc(storeName(x.store))}</span><b>${x.stock ? money(x.price) : 'Sin stock'}</b></div>`).join('')
          : `<span class="o-none">Ninguna otra tienda lo tiene en ${o.ml} ml.</span>`}
      </div>
      ${save}
    </a>`;
  }

  function renderGrid() {
    const list = filtered();
    const grid = document.getElementById('grid'), after = document.getElementById('after');
    document.getElementById('resumen').textContent = `${list.length} ofertas con estos filtros`;
    if (!list.length) {
      grid.innerHTML = '';
      after.innerHTML = '<p class="empty">No hay ofertas con esos filtros hoy. Probá con otra tienda o un descuento menor.</p>';
      return;
    }
    grid.innerHTML = list.slice(0, S.shown).map(card).join('');
    after.innerHTML = list.length > S.shown
      ? `<div style="display:flex;justify-content:center"><button type="button" class="more" id="more">Ver más ofertas (${list.length - S.shown} restantes)</button></div>` : '';
    document.getElementById('more')?.addEventListener('click', () => { S.shown += PAGE; renderGrid(); });
  }

  // ---------- ficha ----------
  function renderProduct(id, mlWanted) {
    const p = D.products[id];
    if (!p) { app.className = 'wrap narrow'; app.innerHTML = `<nav class="nav"><a href="#/">← Volver a las ofertas</a></nav><p class="empty">Este perfume ya no está en oferta hoy.</p>`; return; }
    const sizes = Object.values(p.sizes).sort((a, b) => a.ml - b.ml);
    const sz = p.sizes[mlWanted] || sizes.find(s => s.entries.some(e => e.offer)) || sizes[0];
    const ml = sz.ml;
    document.title = `${p.name} ${p.conc || ''} ${ml} ml · ScentFinder`;
    const inStock = sz.entries.filter(e => e.stock).sort((a, b) => a.price - b.price);
    const out = sz.entries.filter(e => !e.stock).sort((a, b) => a.price - b.price);
    const best = inStock[0], worst = inStock[inStock.length - 1];
    const bestOffer = sz.entries.filter(e => e.offer).sort((a, b) => a.price - b.price)[0];
    const pct = bestOffer?.pct ?? best?.pct ?? 0;
    const absent = D.stores.filter(s => !sz.entries.some(e => e.store === s.id)).map(s => s.name);

    let verdict;
    if (best && worst && worst.price > best.price)
      verdict = `<div class="verdict">En <b>${esc(storeName(best.store))}</b> ahorrás <b class="g">${money(worst.price - best.price)}</b> en el frasco de ${ml} ml frente a la tienda más cara (${esc(storeName(worst.store))}).</div>`;
    else if (best && inStock.length > 1)
      verdict = `<div class="verdict alt">Tiene el mismo precio en las ${inStock.length} tiendas con stock.</div>`;
    else if (best)
      verdict = `<div class="verdict alt">Solo <b>${esc(storeName(best.store))}</b> lo tiene con stock en ${ml} ml.</div>`;
    else verdict = `<div class="verdict alt">Ninguna tienda lo tiene con stock en ${ml} ml hoy.</div>`;

    const row = (e) => {
      const isBest = best && e === best && inStock.length > 1;
      const stale = isStale(e.store);
      const meta = !e.stock ? 'Último precio publicado · no cuenta para el mejor precio'
        : `Con stock · ${stale ? `precio del ${dmFromYmd(e.date)} (hoy no se pudo leer)` : 'leído ' + whenLabel(storeMeta(e.store)?.lastRead)}`;
      return `
      <div class="srow${isBest ? ' best' : ''}${e.stock ? '' : ' out'}">
        <div class="who">
          <div class="name"><span>${esc(storeName(e.store))}</span>
            ${isBest ? '<span class="tag best">Mejor precio</span>' : ''}
            ${e.stock && e.offer ? `<span class="tag promo">En oferta −${e.pct}%</span>` : ''}
            ${e.stock ? '' : '<span class="tag out">Sin stock</span>'}
          </div>
          <span class="meta">${esc(meta)}</span>
        </div>
        <div class="amt">
          ${e.list > e.price ? `<s>${money(e.list)}</s>` : ''}
          <b>${money(e.price)}</b>
          <span>${money(e.price / ml)} por ml</span>
        </div>
        <a class="btn${isBest ? ' primary' : ''}" href="${esc(e.url)}" target="_blank" rel="noopener">Ir a ${esc(storeName(e.store))} →</a>
      </div>`;
    };

    // historial
    const offerStore = bestOffer?.store;
    const days = offerStore ? sz.daysOnSale?.[offerStore] || 1 : null;
    const first = D.historyFrom;
    const daysTxt = !offerStore ? '—' : days === 1 ? 'Desde hoy' : `${days} días seguidos`;
    const daysNote = offerStore ? `En ${storeName(offerStore)}${first ? ` · historial desde el ${dmFromYmd(first)}` : ''}.` : 'Hoy no está en oferta en este tamaño.';
    const ms = sz.minSeen;
    const minTxt = ms ? money(ms.price) : '—';
    const minNote = ms ? `${storeName(ms.store)}, ${dmFromYmd(ms.date)}. Entre las ${D.stores.length} tiendas, con stock.` : 'Sin datos todavía.';

    app.className = 'wrap narrow';
    app.innerHTML = `
    <nav class="nav">
      <a href="#/">← Volver a las ofertas</a>
      <span>Actualizado <b>${whenLabel(D.generatedAt)}</b></span>
    </nav>
    <main class="sheet">
      <div class="s-head">
        ${thumb(sz.image || p.image, `${p.brand} ${p.name}`, 'thumb big')}
        <div class="s-id">
          <span class="brand">${esc(p.brand)}</span>
          <h1>${esc(p.name)} <small>${esc(p.conc || '')}</small></h1>
          ${sz.ean ? `<span class="sub">EAN ${esc(sz.ean)}</span>` : ''}
        </div>
        ${pct ? `<div class="s-badge"><span class="pct">−${pct}%</span><span>vs. su precio de lista${bestOffer ? ` en ${esc(storeName(bestOffer.store))}` : ''}</span></div>` : ''}
      </div>
      <div class="sizes" role="group" aria-label="Tamaño">
        ${sizes.map(s => `<a class="size" href="#/p/${encodeURIComponent(id)}/${s.ml}" aria-current="${s.ml === ml}">${s.ml} ml${s.entries.some(e => e.offer) ? '<span class="dot" title="En oferta"></span>' : ''}</a>`).join('')}
      </div>
      ${verdict}
      <div class="rows">${[...inStock, ...out].map(row).join('')}</div>
      ${absent.length ? `<p class="absent">No lo tienen en ${ml} ml: ${esc(absent.join(', '))}.</p>` : ''}
    </main>
    <section class="stats">
      <div class="stat"><span class="lbl">Desde cuándo está en oferta</span><span class="v">${daysTxt}</span><span class="n">${esc(daysNote)}</span></div>
      <div class="stat"><span class="lbl">Precio más bajo visto</span><span class="v">${minTxt}</span><span class="n">${esc(minNote)}</span></div>
      <div class="stat"><span class="lbl">Precio por ml</span><span class="v">${best ? money(best.price / ml) : '—'}</span><span class="n">${best ? `El mejor precio con stock, en ${esc(storeName(best.store))}.` : ''}</span></div>
    </section>
    <footer class="foot">La compra se hace en la tienda. Confirmá ahí el precio y el tamaño antes de pagar.</footer>`;
    window.scrollTo(0, 0);
  }

  // ---------- cómo funciona ----------
  function renderHow() {
    document.title = 'Cómo funciona · ScentFinder';
    app.className = 'wrap';
    const pl = { juleriaque: 'VTEX · API de catálogo', rouge: 'VTEX · API de catálogo', beauty24: 'VTEX · API de catálogo', pigmento: 'VTEX · API de catálogo', parfumerie: 'Magento · página de producto', ruizyroca: 'Tiendanube · variantes del producto' };
    const minPct = Math.round(D.minDiscount * 100);
    app.innerHTML = `
    <nav class="nav"><a href="#/">← Volver a las ofertas</a><span>Actualizado <b>${whenLabel(D.generatedAt)}</b></span></nav>
    <div style="display:flex;flex-direction:column;gap:6px">
      <span class="eyebrow">ScentFinder Ofertas</span>
      <h1 class="page">Cómo funciona</h1>
    </div>
    <div class="spec-grid">
      <section class="box">
        <h2>1 · De dónde salen los precios</h2>
        <div class="kv">${D.stores.map(s => `<span><b>${esc(s.name)}</b><br><small style="color:var(--muted)">${esc(pl[s.id] || '')}</small></span><span>${s.lastRead ? 'Leído ' + esc(whenLabel(s.lastRead)) : 'Sin datos'}</span>`).join('')}</div>
        <p class="note">Se recorre la categoría de perfumes de hombre completa de cada tienda, no una lista fija. Parfumerie bloquea la lectura automática, por eso puede figurar sin datos.</p>
      </section>
      <section class="box">
        <h2>2 · Qué cuenta como oferta</h2>
        <ul>
          <li>Precio actual menor al precio de lista de la misma tienda.</li>
          <li>Descuento de al menos <b>${minPct}%</b>.</li>
          <li>Con stock en ese tamaño.</li>
          <li>Cualquier perfume de hombre de cualquier marca, de 30 a 200 ml.</li>
          <li>Se excluyen sets, kits, estuches, testers, desodorantes, geles, recargas, miniaturas y combos.</li>
        </ul>
      </section>
      <section class="box">
        <h2>3 · Cómo se compara entre tiendas</h2>
        <p>Mismo producto = mismo <b>código de barras (EAN)</b> cuando las dos tiendas lo publican. Si no, misma <b>marca + nombre + concentración + tamaño</b>, sin importar acentos ni mayúsculas.</p>
        <p>Para cada oferta se muestra el precio de ese mismo frasco en las otras tiendas, esté o no en oferta allá.</p>
        <p class="note">Ahorro = tienda más cara con stock − precio de la oferta. Lo que no tiene stock se muestra en gris y no cuenta.</p>
      </section>
      <section class="box">
        <h2>4 · Actualización</h2>
        <ul>
          <li>Una vez por día a las <b>7:00</b> (hora Argentina).</li>
          <li>Se guarda una foto diaria de precios para calcular “días en oferta” y “precio más bajo visto”.</li>
          <li>Si una tienda falla, se mantienen sus precios del día anterior y se muestra la fecha.</li>
        </ul>
      </section>
      <section class="box warm">
        <h2>5 · A tener en cuenta</h2>
        <ul>
          <li>Rouge y Beauty 24 comparten catálogo y precios: aparecen las dos.</li>
          <li>Algunos “precios de lista” están inflados: el % compara contra la propia tienda; el ahorro real es contra las otras.</li>
          <li>Si una tienda tiene varias versiones del mismo frasco (normal, recargable, edición limitada), se muestra la más barata con stock.</li>
          <li>No se incluyen descuentos por medio de pago ni promociones bancarias.</li>
        </ul>
      </section>
    </div>`;
    window.scrollTo(0, 0);
  }

  // ---------- rutas ----------
  let lastRoute = '';
  function route() {
    if (!D) return;
    const h = location.hash.replace(/^#/, '') || '/';
    const m = h.match(/^\/p\/([^/]+)\/?(\d+)?/);
    const wasHome = lastRoute === '/';
    lastRoute = m ? 'p' : h;
    if (m) return renderProduct(decodeURIComponent(m[1]), m[2]);
    if (h.startsWith('/como-funciona')) return renderHow();
    const y = window.__homeScroll || 0;
    renderHome();
    if (!wasHome) window.scrollTo(0, y);
  }
  window.addEventListener('hashchange', () => {
    if (lastRoute === '/') window.__homeScroll = window.scrollY;
    route();
  });
  load();
})();
