// Handlers de Web Push do service worker — SÓ APIs nativas (sem Workbox/lib).
// Este arquivo é "pendurado" no service worker que o vite-plugin-pwa gera, via
//   workbox: { importScripts: ['push-sw.js'] }   (ver vite.config.js).
// O payload do push é um JSON montado pelo servidor (Edge Function, fase 3):
//   { titulo, corpo, url, tag }  — url = deep-link tipo "/?demanda=12".

// Chega um push -> mostra a notificação na barra do SO.
self.addEventListener('push', (event) => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch (_) {
    dados = {}
  }
  const titulo = dados.titulo || 'Service Desk'
  const opcoes = {
    body: dados.corpo || '',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    tag: dados.tag || undefined, // agrupa/atualiza avisos da mesma demanda
    renotify: !!dados.tag,
    data: { url: dados.url || '/' }, // lido no clique
  }
  event.waitUntil(self.registration.showNotification(titulo, opcoes))
})

// Toque na notificação -> foca uma janela do app já aberta (e navega até a
// demanda) ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const janela of janelas) {
        if ('focus' in janela) {
          await janela.focus()
          if ('navigate' in janela) {
            try {
              await janela.navigate(destino)
            } catch (_) {
              // navigate pode falhar em alguns navegadores; a janela ja esta focada
            }
          }
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(destino)
    })(),
  )
})
