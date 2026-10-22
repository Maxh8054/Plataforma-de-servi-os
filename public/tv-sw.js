/* Modo offline do Painel TV ZAMine (registrado pelo painel-tv-*.html):
   - FOTOS (/api/tv/assets/*): cache-first — são imutáveis (id único), então
     depois da primeira exibição a TV nunca mais fica sem elas.
   - CONTEÚDO (/api/tv/<painel>/content): rede primeiro; se a internet cair,
     serve o último conteúdo guardado.
   - A PRÓPRIA PÁGINA do painel: rede primeiro; caiu, serve do cache — a TV
     recarregada continua funcionando mesmo sem internet.
   Assim a TV nunca fica preta/travada quando a conexão cai. */
const CACHE = "ztv-offline-v1";

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== location.origin) return;

  // fotos do painel: imutáveis — cache primeiro
  if (url.pathname.startsWith("/api/tv/assets/")) {
    event.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res && res.ok) c.put(req, res.clone());
        return res;
      }).catch(() => fetch(req))
    );
    return;
  }

  // conteúdo do painel e a própria página: rede primeiro, cache como reserva
  const conteudo = /^\/api\/tv\/[a-z0-9]+\/content$/.test(url.pathname);
  const pagina = /painel-tv-[a-z0-9]+\.html$/.test(url.pathname);
  if (conteudo || pagina) {
    const chave = url.pathname + (url.search || "");
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          caches.open(CACHE).then((c) => c.put(chave, res.clone())).catch(() => {});
        }
        return res;
      }).catch(async () => {
        const c = await caches.open(CACHE);
        return (await c.match(chave)) || (await c.match(url.pathname)) || Response.error();
      })
    );
  }
});
