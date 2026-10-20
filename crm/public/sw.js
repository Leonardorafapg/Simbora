// Service worker mínimo (sem cache): só para o Chrome do Android instalar o app de verdade, sem barra de endereço.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
