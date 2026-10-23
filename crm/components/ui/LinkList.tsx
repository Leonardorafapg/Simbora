"use client";

import { useState } from "react";
import { ExternalLink, Plus, X } from "lucide-react";
import { linkLabel, normalizeUrl } from "@/lib/links";

type Props = {
  value: string[];
  onChange: (links: string[]) => void;
  placeholder?: string;
};

const MAX_LINKS = 20;

/** Links anexados (pasta do Drive, Figma...): adiciona por campo de texto e mostra clicáveis. */
export default function LinkList({ value, onChange, placeholder = "Cole um link (ex.: pasta do Drive)" }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!draft.trim()) return;
    const url = normalizeUrl(draft);
    if (!url) return setError("Isso não parece um link válido.");
    if (value.includes(url)) return setError("Esse link já foi adicionado.");
    if (value.length >= MAX_LINKS) return setError(`No máximo ${MAX_LINKS} links.`);
    onChange([...value, url]);
    setDraft("");
    setError(null);
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((url) => (
            <li key={url} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                title={url}
                className="flex min-w-0 flex-1 items-center gap-2 text-sm text-accent hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                <span className="shrink-0 font-medium">{linkLabel(url)}</span>
                <span className="truncate text-xs text-text-faint">{url.replace(/^https?:\/\/(www\.)?/, "")}</span>
              </a>
              <button
                type="button"
                onClick={() => onChange(value.filter((u) => u !== url))}
                aria-label="Remover link"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-faint transition-colors hover:bg-surface-2 hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            // Enter adiciona o link (e não envia o formulário da postagem).
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          // Colar um link já adiciona — o caso comum é copiar a URL da pasta do Drive.
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text");
            const url = normalizeUrl(pasted);
            if (url && !value.includes(url) && value.length < MAX_LINKS) {
              e.preventDefault();
              onChange([...value, url]);
              setDraft("");
              setError(null);
            }
          }}
          placeholder={placeholder}
          className="glass-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          aria-label="Adicionar link"
          title="Adicionar link"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan text-black transition hover:bg-cyan-dark disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
