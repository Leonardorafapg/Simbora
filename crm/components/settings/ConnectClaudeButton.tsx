"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Bot, Check, Copy, ExternalLink } from "lucide-react";
import { CLAUDE_CODE_COMMAND, CLAUDE_CONNECTORS_URL, MCP_URL } from "@/lib/mcp";

type CopyKey = "url" | "command";

/**
 * Inicia a conexão do Claude com o CRM. O login em si é feito pelo Claude, que abre a tela de entrada do
 * Simbora; aqui a pessoa só pega a URL do conector e abre a página do Claude onde ele é adicionado.
 */
export default function ConnectClaudeButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<{ key: CopyKey; ok: boolean } | null>(null);

  async function copy(key: CopyKey, text: string) {
    const ok = await writeClipboard(text);
    setCopied({ key, ok });
    setTimeout(() => setCopied((current) => (current?.key === key ? null : current)), 2500);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded-lg bg-cyan text-black text-xs font-medium px-3 py-1.5 hover:bg-cyan-dark transition-colors ${className}`}
      >
        <Bot className="h-3.5 w-3.5" />
        Conectar com o Claude
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Conectar com o Claude"
              className="glass-modal w-full max-w-md rounded-2xl p-4 sm:p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <h2 className="text-base font-semibold text-text">Conectar com o Claude</h2>
              <p className="mt-1 text-sm text-text-muted">
                O Claude vai abrir a tela de login do Simbora. Entre com o seu email e senha: ele só faz o que as suas
                permissões no CRM permitem.
              </p>

              <ol className="mt-5 space-y-4 text-sm text-text">
                <li>
                  <p className="font-medium text-text">1. Copie a URL do conector</p>
                  <CopyRow value={MCP_URL} state={copied?.key === "url" ? copied : null} onCopy={() => copy("url", MCP_URL)} />
                </li>
                <li>
                  <p className="font-medium text-text">2. Adicione no Claude</p>
                  <p className="mt-1 text-text-muted">
                    Em Conectores, clique em <strong>Adicionar conector personalizado</strong>, cole a URL e clique em
                    Conectar.
                  </p>
                  <a
                    href={CLAUDE_CONNECTORS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-text hover:border-cyan/50"
                  >
                    Abrir Conectores do Claude
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </li>
                <li>
                  <p className="font-medium text-text">Usa o Claude Code?</p>
                  <CopyRow
                    value={CLAUDE_CODE_COMMAND}
                    state={copied?.key === "command" ? copied : null}
                    onCopy={() => copy("command", CLAUDE_CODE_COMMAND)}
                  />
                  <p className="mt-1 text-xs text-text-muted">
                    Depois rode <code>/mcp</code> no Claude Code e escolha simbora → Authenticate.
                  </p>
                </li>
              </ol>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm text-text hover:text-text"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// Clipboard API exige HTTPS e permissão; o execCommand cobre navegadores/contextos que a negam.
async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(area);
    }
  }
}

function CopyRow({
  value,
  state,
  onCopy,
}: {
  value: string;
  state: { ok: boolean } | null;
  onCopy: () => void;
}) {
  const copied = state?.ok === true;
  const failed = state?.ok === false;
  return (
    <div className="mt-1 flex items-center gap-2">
      <code className="min-w-0 flex-1 select-all truncate rounded-lg border border-border bg-black/20 px-3 py-2 text-xs text-text">
        {value}
      </code>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copiar"
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-text hover:border-cyan/50"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Copiado" : failed ? "Selecione e copie" : "Copiar"}
      </button>
    </div>
  );
}
