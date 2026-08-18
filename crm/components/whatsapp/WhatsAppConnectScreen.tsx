"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Smartphone } from "lucide-react";
import { connect } from "@/services/client/whatsappApi";

type Props = {
  onConnected: () => void;
};

const QR_EXPIRY_SECONDS = 20;

export default function WhatsAppConnectScreen({ onConnected }: Props) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  async function requestQrCode() {
    setLoading(true);
    setError(null);
    setExpired(false);

    try {
      const result = await connect();
      if (result.connected) {
        onConnected();
        return;
      }
      setQrCode(result.base64);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível gerar o QR code.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    requestQrCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!qrCode) return;
    const timeout = setTimeout(() => setExpired(true), QR_EXPIRY_SECONDS * 1000);
    return () => clearTimeout(timeout);
  }, [qrCode]);

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="glass-card rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm w-full text-center">
        <div className="h-12 w-12 rounded-full bg-cyan/10 flex items-center justify-center text-cyan">
          <Smartphone className="h-6 w-6" />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">Conectar WhatsApp</h2>
          <p className="text-sm text-white/60 mt-1">
            Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o código abaixo.
          </p>
        </div>

        {loading && (
          <div className="h-56 w-56 rounded-xl bg-white/5 animate-pulse flex items-center justify-center text-white/40 text-sm">
            Gerando QR code...
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={requestQrCode}
              className="flex items-center gap-2 rounded-lg bg-cyan text-black text-sm font-medium px-4 py-2 hover:bg-cyan-dark transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {!loading && !error && qrCode && (
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI, sem loader configurado */}
            <img
              src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
              alt="QR code para conectar o WhatsApp"
              className="h-56 w-56 rounded-xl bg-white p-2"
            />
            {expired ? (
              <button
                type="button"
                onClick={requestQrCode}
                className="flex items-center gap-2 rounded-lg bg-cyan text-black text-sm font-medium px-4 py-2 hover:bg-cyan-dark transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Gerar novo QR code
              </button>
            ) : (
              <p className="text-xs text-white/40">Aguardando leitura do código...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
