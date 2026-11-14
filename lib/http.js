const UA = 'Mozilla/5.0 (compatible; ScentFinderOfertas/1.0)';
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export async function get(url, { json = false, retries = 2, timeout = 30000, headers = {} } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, {
        headers: { 'user-agent': UA, accept: json ? 'application/json' : 'text/html', ...headers },
        signal: AbortSignal.timeout(timeout),
      });
      if (r.status === 403 || r.status === 401) {
        const e = new Error(`HTTP ${r.status} (bloqueado) ${url}`); e.fatal = true; throw e;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
      const body = json ? await r.json() : await r.text();
      return { status: r.status, headers: r.headers, body };
    } catch (e) {
      lastErr = e;
      if (e.fatal) throw e;
      await sleep(1000 * (attempt + 1));
    }
  }
  throw lastErr;
}

export async function pool(items, n, fn) {
  let i = 0;
  const out = new Array(items.length);
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      try { out[k] = await fn(items[k], k); } catch (e) { out[k] = { error: e }; }
    }
  }));
  return out;
}
