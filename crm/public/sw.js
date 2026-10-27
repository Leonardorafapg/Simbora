// Service worker mínimo (sem cache): só para o Chrome do Android instalar o app de verdade, sem barra de endereço.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});

// --- Notificações push (avisos do CRM no celular) -------------------------------------------------
const isApple = /iPhone|iPad|iPod/.test(self.navigator.userAgent);

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // push sem JSON: mostra o aviso genérico
  }

  event.waitUntil(
    (async () => {
      // Com o CRM aberto e visível o sino já mostra o aviso. No iPhone toda push precisa virar notificação
      // (senão o Safari cancela a inscrição), então lá sempre mostra.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (!isApple && windows.some((w) => w.visibilityState === "visible")) return;

      await self.registration.showNotification(data.title || "Simbora CRM", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: data.id ? `aviso-${data.id}` : undefined,
        data: { link: data.link || "/" },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(link);
          return;
        }
      }
      await self.clients.openWindow(link);
    })(),
  );
});
