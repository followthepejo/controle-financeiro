// Guarda o app no celular para abrir rápido e funcionar sem internet (os dados vêm do GitHub quando houver internet).
// Só arquivos do próprio site passam por aqui; o GitHub (api.github.com) nunca é guardado em cache.
const VERSAO = '6cf954543be6';
const CACHE = `cf-${VERSAO}`;
const BASICOS = ['./', 'index.html', 'estilo.css', 'manifest.webmanifest', 'icones/icone-192.png', 'icones/apple-180.png',
  'js/app.js', 'js/cofre-local.js', 'js/ui.js', 'js/ocr-celular.js', 'js/ocr-linhas.js',
  'js/telas/inicio.js', 'js/telas/lancar.js', 'js/telas/cartao.js', 'js/telas/print.js', 'js/telas/ajustes.js',
  'js/comum/util.js', 'js/comum/calculos.js', 'js/comum/conciliar.js', 'js/comum/assinaturas.js', 'js/comum/lancamentos.js', 'js/comum/montar-print.js',
  'js/comum/sync/cripto.js', 'js/comum/sync/github.js', 'js/comum/sync/orquestrar.js', 'js/comum/sync/sincronizar.js', 'js/comum/sync/configuracao.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(BASICOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const guardado = await c.match(e.request, { ignoreSearch: true });
    if (guardado) return guardado;
    const r = await fetch(e.request);
    if (r.ok && (u.pathname.includes('/vendor/') || u.pathname.includes('/icones/'))) c.put(e.request, r.clone()); // leitor de texto: guarda depois do 1º uso
    return r;
  }));
});
