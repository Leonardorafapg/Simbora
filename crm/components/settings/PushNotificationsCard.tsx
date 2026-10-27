"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import Button from "@/components/ui/Button";
import { pushState, urlBase64ToUint8Array, type PushState } from "@/lib/push";
import { fetchPushStatus, sendPushTest, subscribePush, unsubscribePush } from "@/services/client/pushApi";

const MESSAGES: Record<PushState, string> = {
  unsupported: "Este navegador não suporta notificações no celular. Tente o Chrome (Android) ou o Safari (iPhone).",
  server_off: "As notificações no celular ainda não foram ativadas no servidor. Peça ao administrador.",
  needs_install: "No iPhone, primeiro adicione o CRM à tela inicial (Compartilhar → Adicionar à Tela de Início) e abra por lá.",
  denied: "A permissão foi negada neste aparelho. Libere as notificações do site nas configurações do navegador.",
  off: "Receba demandas novas, compromissos e prazos direto no celular, mesmo com o CRM fechado.",
  on: "Este aparelho recebe as notificações do CRM.",
};

type Info = { state: PushState; publicKey: string | null; devices: number };

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

async function readInfo(): Promise<Info> {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

  let serverEnabled = false;
  let publicKey: string | null = null;
  let devices = 0;
  try {
    const status = await fetchPushStatus();
    serverEnabled = status.enabled;
    publicKey = status.public_key;
    devices = status.devices;
  } catch {
    // sem rede: segue como "servidor desligado" pra não prometer o que não dá
  }

  const subscribed = supported ? (await currentSubscription()) !== null : false;
  return {
    publicKey,
    devices,
    state: pushState({
      supported,
      serverEnabled,
      isIos,
      standalone,
      permission: supported ? Notification.permission : "unsupported",
      subscribed,
    }),
  };
}

/** Cartão das Configurações: ativa/desativa a notificação push neste aparelho e manda um teste. */
export default function PushNotificationsCard() {
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => setInfo(await readInfo()), []);

  useEffect(() => {
    let cancelled = false;
    readInfo().then((next) => {
      if (!cancelled) setInfo(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    if (!info?.publicKey) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        await refresh();
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(info.publicKey),
        }));
      await subscribePush(subscription.toJSON());
      setMessage("Notificações ativadas neste aparelho.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await unsubscribePush(subscription.endpoint);
        await subscription.unsubscribe();
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível desativar.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await sendPushTest();
      setMessage("Teste enviado — deve chegar em instantes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o teste.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          {info?.state === "on" ? <BellRing className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-text">Notificações no celular</h2>
          <p className="mt-1 text-sm text-text-muted">{info ? MESSAGES[info.state] : "Verificando..."}</p>
          {info && info.devices > 0 && (
            <p className="mt-1 text-xs text-text-faint">
              {info.devices} aparelho{info.devices > 1 ? "s" : ""} recebendo na sua conta.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {info?.state === "off" && (
              <Button onClick={enable} disabled={busy}>
                {busy ? "Ativando..." : "Ativar neste aparelho"}
              </Button>
            )}
            {info?.state === "on" && (
              <>
                <Button variant="secondary" onClick={test} disabled={busy}>
                  Enviar teste
                </Button>
                <Button variant="ghost" onClick={disable} disabled={busy}>
                  Desativar
                </Button>
              </>
            )}
          </div>

          {message && <p className="mt-3 text-sm text-accent">{message}</p>}
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  );
}
