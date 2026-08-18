"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ChecklistItem } from "@/types/demand";

type Props = {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
};

export default function ChecklistEditor({ items, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function addItem() {
    const text = draft.trim();
    if (!text) return;
    onChange([...items, { id: crypto.randomUUID(), text, done: false }]);
    setDraft("");
  }

  function toggleItem(id: string) {
    onChange(items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleItem(item.id)}
                className="shrink-0"
              />
              <span className={`text-sm flex-1 min-w-0 truncate ${item.done ? "line-through text-white/40" : "text-white/80"}`}>
                {item.text}
              </span>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-white/20 hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remover item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder="Adicionar item..."
          className="glass-input rounded-lg px-3 py-2 text-sm outline-none w-full"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim()}
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-2 text-white/70 hover:text-white disabled:opacity-40"
          aria-label="Adicionar"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
