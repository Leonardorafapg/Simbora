/** Chave pública VAPID (base64 url-safe) -> bytes, no formato que `pushManager.subscribe` pede. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushState =
  | "unsupported" // navegador sem Web Push
  | "server_off" // backend sem chaves VAPID
  | "needs_install" // iPhone/iPad: só funciona com o app instalado na tela inicial
  | "denied" // permissão negada no navegador
  | "off" // pode ativar
  | "on"; // este aparelho já recebe

export type PushEnv = {
  supported: boolean;
  serverEnabled: boolean;
  isIos: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
};

/** Em que pé está a notificação push neste aparelho (decide o que a tela mostra). */
export function pushState(env: PushEnv): PushState {
  if (env.isIos && !env.standalone) return "needs_install";
  if (!env.supported || env.permission === "unsupported") return "unsupported";
  if (!env.serverEnabled) return "server_off";
  if (env.permission === "denied") return "denied";
  return env.permission === "granted" && env.subscribed ? "on" : "off";
}
