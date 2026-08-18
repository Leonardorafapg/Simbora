"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStatus } from "@/services/client/whatsappApi";
import WhatsAppConnectScreen from "@/components/whatsapp/WhatsAppConnectScreen";
import WhatsAppChatLayout from "@/components/whatsapp/WhatsAppChatLayout";

const POLL_INTERVAL_MS = 4000;

export default function WhatsAppPage() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      const status = await getStatus();
      setConnected(status.connected);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (connected) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(checkStatus, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [connected, checkStatus]);

  if (connected === null) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-cyan/30 border-t-cyan animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {connected ? (
        <WhatsAppChatLayout onDisconnected={() => setConnected(false)} />
      ) : (
        <WhatsAppConnectScreen onConnected={() => setConnected(true)} />
      )}
    </div>
  );
}
