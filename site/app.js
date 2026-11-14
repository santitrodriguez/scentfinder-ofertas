(() => {
  'use strict';
  const TZ = 'America/Argentina/Buenos_Aires';
  const PAGE = 60;
  const app = document.getElementById('app');
  let D = null;
  const S = { q: '', store: 'all', min: 0, size: 'all', sort: 'pct', shown: PAGE, card: '' };
  try { S.card = localStorage.getItem('sf-card') || ''; } catch (e) { /* sin almacenamiento */ }

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
  // ---------- promos bancarias ----------
  const DAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  const DAY_LABEL = { lunes: 'lunes', martes: 'martes', miercoles: 'miércoles', jueves: 'jueves', viernes: 'viernes', sabado: 'sábados', domingo: 'domingos' };
  const todayDay = () => DAYS[new Date(new Date().toLocaleString('en-US', { timeZone: TZ })).getDay()];
  const cardName = () => D.promos?.cards.find(c => c.id === S.card)?.name || '';
  // las promos exclusivas de sucursal no se tienen en cuenta (solo se compra online)
  const usable = p => p.channel !== 'sucursal';
  const promosFor = store => !S.card ? [] : (D.promos?.promos || []).filter(p => p.card === S.card && p.store === store && usable(p));
  const daysTxt = p => p.days.includes('todos') ? 'todos los días'
    : p.days.length >= 6 ? 'todos los días excepto ' + DAYS.slice(1).concat('domingo').filter(d => !p.days.includes(d)).map(d => DAY_LABEL[d]).join(' y ')
    : 'los ' + p.days.map(d => DAY_LABEL[d] + (d.endsWith('s') || d === 'sabado' || d === 'domingo' ? '' : '')).join(' y ');
  const chanTxt = p => p.channel === 'sucursal' ? 'solo en sucursal' : p.channel === 'web' ? 'en la web' : 'web y sucursal';
  const isToday = p => p.days.includes('todos') || p.days.includes(todayDay());
  // reintegro o descuento con la tarjeta elegida: precio final y % total contra el precio de lista
  function withCard(store, price, list) {
    const p = promosFor(store).filter(x => x.type !== 'cuotas' && x.pct > 0).sort((a, b) => b.pct - a.pct)[0];
    if (!p) return null;
    const back = Math.min(price * p.pct / 100, p.tope || Infinity);
    const final = price - back;
    return { promo: p, final, back, totalPct: list > 0 ? Math.round((1 - final / list) * 100) : p.pct };
  }
  const cuotasPromo = store => promosFor(store).filter(x => x.type === 'cuotas').sort((a, b) => b.cuotas - a.cuotas)[0];
  const bestPct = o => Math.max(o.pct, withCard(o.store, o.price, o.list)?.totalPct || 0);
  const finalPrice = o => withCard(o.store, o.price, o.list)?.final ?? o.price;
  // precio con tarjeta para cualquier entrada {store, price}; sin tarjeta elegida es el precio normal
  const eff = x => withCard(x.store, x.price, x.list || x.price)?.final ?? x.price;
  const promoTxt = x => { const w = withCard(x.store, x.price, x.list || x.price); return w ? `con ${cardName()}, ${w.promo.pct}% de reintegro ${daysTxt(w.promo)}, ${chanTxt(w.promo)}` : ''; };

  const SIZES = [['all', 'Todos'], ['s', 'Hasta 60 ml'], ['m', '75–125 ml'], ['l', '150 ml o más']];
  const inSize = (ml, k) => k === 'all' || (k === 's' ? ml <= 60 : k === 'm' ? ml > 60 && ml < 150 : ml >= 150);
  const DISC = [[0, 'Todos'], [20, '20% o más'], [30, '30% o más'], [40, '40% o más']];
  const SORTS = [['pct', 'Mayor descuento'], ['price', 'Menor precio'], ['save', 'Mayor ahorro en $'], ['brand', 'Marca A–Z']];
  const sorts = () => S.card ? [SORTS[0], ['final', 'Precio final con mi tarjeta'], ...SORTS.slice(1)] : SORTS;

  // ---------- datos ----------
  async function load() {
    try {
      const r = await fetch('data/ofertas.json', { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      D = await r.json();
      D._perfumes = new Set(D.offers.map(o => o.productId + '|' + o.ml)).size;
      for (const o of D.offers) o._q = fold(`${o.brand} ${o.name} ${o.conc || ''} ${o.ml}ml ${storeName(o.store)}`);
      route();
    } catch (e) {
      app.innerHTML = '<p class="empty">No se pudieron cargar las ofertas. Probá recargar la página en unos minutos.</p>';
    }
  }

  function filtered() {
    const words = fold(S.q).split(/\s+/).filter(Boolean);
    const list = D.offers.filter(o =>
      (S.store === 'all' || o.store === S.store) && bestPct(o) >= S.min && inSize(o.ml, S.size) &&
      words.every(w => o._q.includes(w)));
    // una tarjeta por perfume y tamaño: se queda la mejor oferta (precio con tarjeta si hay) como principal
    const groups = new Map();
    for (const o of list) {
      const k = o.productId + '|' + o.ml, cur = groups.get(k);
      if (!cur || eff(o) < eff(cur) - 0.5 || (Math.abs(eff(o) - eff(cur)) <= 0.5 && o.pct > cur.pct)) groups.set(k, o);
    }
    const heads = [...groups.values()];
    const by = {
      pct: (a, b) => bestPct(b) - bestPct(a) || eff(a) - eff(b),
      final: (a, b) => finalPrice(a) - finalPrice(b) || b.pct - a.pct,
      price: (a, b) => eff(a) - eff(b) || b.pct - a.pct,
      save: (a, b) => groupSave(b) - groupSave(a) || b.pct - a.pct,
      brand: (a, b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es') || a.ml - b.ml || a.price - b.price,
    }[S.sort] || ((a, b) => b.pct - a.pct);
    return heads.sort(by);
  }
  const entriesOf = o => D.products[o.productId]?.sizes?.[o.ml]?.entries || [];
  // ahorro = tienda más cara con stock − el precio de la tarjeta principal
  function groupSave(o) {
    const st = entriesOf(o).filter(e => e.stock && e.store !== o.store);
    return st.length ? Math.max(0, Math.max(...st.map(eff)) - eff(o)) : 0;
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
        <span class="count"><b>${D._perfumes.toLocaleString('es-AR')} perfumes en oferta</b> en ${stores} perfumerías</span>
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
          <select id="orden">${sorts().map(([v, t]) => `<option value="${v}"${S.sort === v ? ' selected' : ''}>${t}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row chips" role="group" aria-label="Tienda"><span class="lbl">Tienda</span>${chips(storeList, S.store, 'store')}</div>
      <div class="row chips" role="group" aria-label="Descuento y tamaño">
        <span class="lbl">Descuento</span>${chips(DISC, S.min, 'min')}
        <span class="sep" aria-hidden="true"></span>
        <span class="lbl">Tamaño</span>${chips(SIZES, S.size, 'size')}
      </div>
      ${D.promos?.cards?.length ? `<div class="row chips" role="group" aria-label="Mi tarjeta"><span class="lbl">Mi tarjeta</span>${chips([['', 'Ninguna'], ...D.promos.cards.map(c => [c.id, c.name])], S.card, 'card')}</div>
      <p class="card-note" id="cardnote"></p>` : ''}
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
      if (k === 'card') {
        try { localStorage.setItem('sf-card', S.card); } catch (e) { /* sin almacenamiento */ }
        if (!S.card && S.sort === 'final') S.sort = 'pct';
        return renderHome();
      }
      app.querySelectorAll(`.chip[data-k="${k}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderGrid();
    }));
    renderGrid();
  }

  function bankLine(store, price, list) {
    if (!S.card) return '';
    const w = withCard(store, price, list), c = cuotasPromo(store);
    if (w) return `<div class="bank${isToday(w.promo) ? ' today' : ''}"><span>Con ${esc(cardName())}: <b>${money(w.final)}</b> <span class="tot">−${w.totalPct}% en total</span></span><span class="cond">${w.promo.pct}% de reintegro ${esc(daysTxt(w.promo))}, ${esc(chanTxt(w.promo))}</span></div>`;
    if (c) return `<div class="bank plain"><span class="cond">${esc(cardName())}: hasta ${c.cuotas} cuotas sin interés${c.minAmount ? ` desde ${money(c.minAmount)}` : ''}, sin reintegro</span></div>`;
    return `<div class="bank plain"><span class="cond">Sin promo con ${esc(cardName())} en esta tienda</span></div>`;
  }

  function card(o) {
    const entries = entriesOf(o);
    const inStock = entries.filter(e => e.stock).sort((a, b) => eff(a) - eff(b) || a.price - b.price);
    const out = entries.filter(e => !e.stock);
    const best = inStock[0];
    const multi = inStock.length > 1;
    const allSame = multi && inStock.every(e => Math.abs(eff(e) - eff(best)) <= 0.5);
    const rows = [...inStock, ...out].map(e => {
      const isHead = e.store === o.store, isBest = multi && !allSame && e.stock && eff(e) <= eff(best) + 0.5;
      const withC = e.stock && eff(e) < e.price - 0.5;
      return `<div class="o-row${e.stock ? '' : ' out'}${isHead ? ' head' : ''}">
        <span class="st">${esc(storeName(e.store))}${isBest ? '<i class="tag best">Mejor precio</i>' : ''}${e.stock && e.offer ? `<i class="tag promo">−${e.pct}%</i>` : ''}</span>
        <b>${!e.stock ? 'Sin stock' : withC ? `${money(eff(e))}<small> con tarjeta</small>` : money(e.price)}</b>
      </div>`;
    }).join('');
    const saveAmt = groupSave(o);
    let save;
    if (best && best.store !== o.store && eff(best) < eff(o) - 0.5)
      save = `<div class="save alt"><span>Más barato en <b>${esc(storeName(best.store))}</b>: <b>${money(eff(best))}</b>${best.offer ? '' : ' <span class="why">(sin oferta)</span>'}</span><span class="go">Comparar →</span></div>`;
    else if (saveAmt > 0.5) save = `<div class="save"><span>Ahorrás <b>${money(saveAmt)}</b> vs. la más cara</span><span class="go">Comparar →</span></div>`;
    else if (multi) save = `<div class="save"><span>Mismo precio en ${inStock.length} tiendas</span><span class="go">Comparar →</span></div>`;
    else save = `<div class="save"><span>Solo ${esc(storeName(o.store))} lo tiene con stock</span><span class="go">Ver ficha →</span></div>`;
    const stale = isStale(o.store) ? `<span class="stale">Precio del ${dmFromYmd(o.date)}</span>` : `<span class="perml">${money(o.price / o.ml)} por ml</span>`;
    const sameAs = inStock.filter(e => e.store !== o.store && Math.abs(eff(e) - eff(o)) <= 0.5).map(e => storeName(e.store));
    return `
    <a class="card" href="#/p/${encodeURIComponent(o.productId)}/${o.ml}">
      <div class="c-head">
        ${thumb(o.image, `${o.brand} ${o.name}`)}
        <div class="c-id">
          <span class="brand">${esc(o.brand)}</span>
          <span class="pname">${esc(o.name)}</span>
          <span class="spec">${esc(o.conc || 'Fragancia')} · ${o.ml} ml</span>
        </div>
        <span class="pct">−${bestPct(o)}%</span>
      </div>
      <div class="prices"><span class="price">${money(o.price)}</span><s class="was">${money(o.list)}</s></div>
      <div class="where"><span>en <b>${esc(storeName(o.store))}</b>${sameAs.length ? `<span class="also">${sameAs.length > 1 ? ', ' + esc(sameAs.slice(0, -1).join(', ')) : ''} y ${esc(sameAs.at(-1))}</span>` : ''}</span>${stale}</div>
      ${bankLine(o.store, o.price, o.list)}
      <div class="others">
        <span class="lbl">Precios en ${entries.length} ${entries.length === 1 ? 'tienda' : 'tiendas'}</span>
        ${rows}
      </div>
      ${save}
    </a>`;
  }

  function cardNote() {
    const el = document.getElementById('cardnote');
    if (!el) return;
    if (!S.card) { el.textContent = ''; el.hidden = true; return; }
    const ps = (D.promos?.promos || []).filter(p => p.card === S.card);
    const re = ps.filter(p => p.type !== 'cuotas' && usable(p));
    el.hidden = false;
    if (!re.length) {
      el.innerHTML = `Hoy ninguna tienda tiene reintegro online con ${esc(cardName())}; solo cuotas sin interés.`;
      return;
    }
    el.innerHTML = re.length
      ? re.map(p => `<b>${esc(storeName(p.store))}</b>: ${p.pct}% de reintegro${p.tope ? ` (tope ${money(p.tope)})` : ' sin tope'}, ${esc(daysTxt(p))}, ${esc(chanTxt(p))}${p.until ? `, hasta el ${dmFromYmd(p.until)}` : ''}${isToday(p) ? ' · <b class="hoy">¡hoy aplica!</b>' : ''}.`).join(' ')
      : `Hoy ninguna tienda tiene reintegro con ${esc(cardName())}; solo cuotas sin interés.`;
  }

  function renderGrid() {
    cardNote();
    const list = filtered();
    const grid = document.getElementById('grid'), after = document.getElementById('after');
    document.getElementById('resumen').textContent = `${list.length} perfumes con estos filtros`;
    if (!list.length) {
      grid.innerHTML = '';
      after.innerHTML = '<p class="empty">No hay ofertas con esos filtros hoy. Probá con otra tienda o un descuento menor.</p>';
      return;
    }
    grid.innerHTML = list.slice(0, S.shown).map(card).join('');
    after.innerHTML = list.length > S.shown
      ? `<div style="display:flex;justify-content:center"><button type="button" class="more" id="more">Ver más perfumes (${list.length - S.shown} restantes)</button></div>` : '';
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
    const inStock = sz.entries.filter(e => e.stock).sort((a, b) => eff(a) - eff(b) || a.price - b.price);
    const out = sz.entries.filter(e => !e.stock).sort((a, b) => a.price - b.price);
    const best = inStock[0], worst = inStock[inStock.length - 1];
    const bestOffer = sz.entries.filter(e => e.offer).sort((a, b) => eff(a) - eff(b) || a.price - b.price)[0];
    const pct = (bestOffer && withCard(bestOffer.store, bestOffer.price, bestOffer.list)?.totalPct) ?? bestOffer?.pct ?? best?.pct ?? 0;
    const absent = D.stores.filter(s => !sz.entries.some(e => e.store === s.id)).map(s => s.name);

    let verdict;
    const plainBest = [...inStock].sort((a, b) => a.price - b.price)[0];
    if (best && worst && eff(worst) > eff(best) + 0.5) {
      const withC = eff(best) < best.price;
      verdict = `<div class="verdict">${withC
        ? `Con <b>${esc(cardName())}</b>, el mejor precio es en <b>${esc(storeName(best.store))}</b>: <b class="g">${money(eff(best))}</b> (${esc(promoTxt(best).replace(/^con [^,]+, /, ''))}). Ahorrás <b class="g">${money(eff(worst) - eff(best))}</b> frente a la tienda más cara (${esc(storeName(worst.store))}).${plainBest && plainBest !== best ? ` Sin la promo, el más barato es ${esc(storeName(plainBest.store))} (${money(plainBest.price)}).` : ''}`
        : `En <b>${esc(storeName(best.store))}</b> ahorrás <b class="g">${money(eff(worst) - eff(best))}</b> en el frasco de ${ml} ml frente a la tienda más cara (${esc(storeName(worst.store))}).`}</div>`;
    } else if (best && inStock.length > 1)
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
          ${e.stock ? bankLine(e.store, e.price, e.list) : ''}
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
        ${pct ? `<div class="s-badge"><span class="pct">−${pct}%</span><span>vs. su precio de lista${bestOffer ? ` en ${esc(storeName(bestOffer.store))}` : ''}${bestOffer && eff(bestOffer) < bestOffer.price ? `, con ${esc(cardName())}` : ''}</span></div>` : ''}
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
      <div class="stat"><span class="lbl">Precio por ml</span><span class="v">${best ? money(eff(best) / ml) : '—'}</span><span class="n">${best ? `El mejor precio con stock, en ${esc(storeName(best.store))}${eff(best) < best.price ? ` (con ${esc(cardName())})` : ''}.` : ''}</span></div>
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
      <section class="box">
        <h2>5 · Promos bancarias</h2>
        <p>Elegí tu tarjeta en “Mi tarjeta” y cada oferta muestra el precio final con el reintegro sumado, y en qué días y canal aplica.</p>
        <ul>${(D.promos?.promos || []).filter(usable).map(p => `<li><b>${esc(storeName(p.store))}</b> · ${esc(D.promos.cards.find(c => c.id === p.card)?.name || p.card)}: ${esc(p.detail)}${p.until ? ` Hasta el ${dmFromYmd(p.until)}.` : ''}</li>`).join('') || '<li>No hay promos cargadas.</li>'}</ul>
        <p class="note">Las promos se revisan a mano en la página de cada tienda (última revisión: ${dmFromYmd((D.promos?.promos || []).map(p => p.checked).sort().pop() || '')}). Confirmá siempre en la tienda o en la app del banco antes de pagar.</p>
      </section>
      <section class="box warm">
        <h2>6 · A tener en cuenta</h2>
        <ul>
          <li>Rouge y Beauty 24 comparten catálogo y precios: aparecen las dos.</li>
          <li>Algunos “precios de lista” están inflados: el % compara contra la propia tienda; el ahorro real es contra las otras.</li>
          <li>Si una tienda tiene varias versiones del mismo frasco (normal, recargable, edición limitada), se muestra la más barata con stock.</li>
          <li>El % grande de cada oferta es el descuento de la tienda. El reintegro de tu tarjeta se suma aparte, solo si elegís “Mi tarjeta”.</li>
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
