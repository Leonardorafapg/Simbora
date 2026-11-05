"use client";

import { useState } from "react";

type Category = { id: string; label: string; icon: string; emojis: string[] };

const split = (value: string) => Array.from(new Intl.Segmenter("pt-BR", { granularity: "grapheme" }).segment(value), (s) => s.segment).filter((e) => e.trim());

const CATEGORIES: Category[] = [
  {
    id: "rostos",
    label: "Rostos",
    icon: "😀",
    emojis: split(
      "😀😃😄😁😆😅😂🤣🥲☺️😊😇🙂🙃😉😌😍🥰😘😗😙😚😋😛😝😜🤪🤨🧐🤓😎🥸🤩🥳😏😒😞😔😟😕🙁☹️😣😖😫😩🥺😢😭😤😠😡🤬🤯😳🥵🥶😱😨😰😥😓🤗🤔🫡🤭🤫🫢😶😐😑😬🙄😯😦😧😮😲🥱😴🤤😪😵🤐🥴🤢🤮🤧😷🤒🤕🤑🤠😈👻💀☠️🤡💩🙈🙉🙊",
    ),
  },
  {
    id: "gestos",
    label: "Gestos",
    icon: "👍",
    emojis: split("👍👎👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆👇☝️✋🤚🖐️🖖👋🤝🙏👏🙌👐🤲🫶💪🫵✍️💅🙋‍♀️🙋‍♂️🤷‍♀️🤷‍♂️🤦‍♀️🤦‍♂️💁‍♀️💁‍♂️🙆‍♀️🙆‍♂️👀🧠"),
  },
  {
    id: "coracoes",
    label: "Corações",
    icon: "❤️",
    emojis: split("❤️🧡💛💚💙💜🖤🤍🤎💔❤️‍🔥❣️💕💞💓💗💖💘💝💟♥️😻💌💋🌹🥀"),
  },
  {
    id: "trabalho",
    label: "Trabalho",
    icon: "💼",
    emojis: split("💼📱💻🖥️⌨️🖱️📷🎥🎬📞☎️📧📩📅🗓️📌📍📎🖇️📝✏️📊📈📉📁📂🗂️✅☑️❌❎⚠️❗❓💡🔔🔍🔒🔑⏰⌛🕐🚀🎯💯🔥✨⭐🌟🎉🎊🎁🏆🥇💰💵💳🧾🛒📦"),
  },
  {
    id: "natureza",
    label: "Natureza",
    icon: "🌸",
    emojis: split("🌞🌝🌙⭐🌈☁️⛅🌧️⚡❄️🔥💧🌊🌸🌺🌹🌷🌻🌼🌴🌵🍀🌿🍃🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🐔🐧🐦🦄🐝🦋🐢🐙🐬🐳"),
  },
  {
    id: "comida",
    label: "Comida",
    icon: "🍕",
    emojis: split("🍎🍊🍋🍌🍉🍇🍓🍒🍑🥭🍍🥥🥑🍅🥕🌽🥐🍞🧀🍳🥞🥓🍔🍟🍕🌭🥪🌮🌯🍝🍜🍣🍤🍦🍩🍪🎂🍰🍫🍬🍿☕🍵🥤🍺🍻🥂🍷🍸🍹"),
  },
  {
    id: "simbolos",
    label: "Símbolos",
    icon: "✔️",
    emojis: split("✔️✖️➕➖➗♻️🔴🟠🟡🟢🔵🟣⚫⚪🟥🟧🟨🟩🟦🟪⬆️⬇️⬅️➡️↗️↘️🔄🔁▶️⏸️⏹️🔊🔇🆗🆕🆓🔝🔜💤🏳️🏁🚩"),
  },
];

const RECENT_KEY = "wa-recent-emojis";
const MAX_RECENT = 24;

function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function saveRecent(emoji: string) {
  try {
    const next = [emoji, ...loadRecent().filter((e) => e !== emoji)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
}

type Props = {
  onPick: (emoji: string) => void;
};

/** Seletor de emojis em abas (sem biblioteca): "Recentes" guarda os últimos usados neste navegador. */
export default function EmojiPicker({ onPick }: Props) {
  const [recent, setRecent] = useState<string[]>(() => (typeof window === "undefined" ? [] : loadRecent()));
  const [tab, setTab] = useState<string>(() => (typeof window !== "undefined" && loadRecent().length > 0 ? "recentes" : "rostos"));

  const tabs: Category[] = [{ id: "recentes", label: "Recentes", icon: "🕘", emojis: recent }, ...CATEGORIES];
  const active = tabs.find((t) => t.id === tab) ?? CATEGORIES[0];

  function pick(emoji: string) {
    saveRecent(emoji);
    setRecent(loadRecent());
    onPick(emoji);
  }

  return (
    <div
      role="dialog"
      aria-label="Emojis"
      className="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-menu"
    >
      <div role="tablist" className="flex border-b border-border bg-surface-2/60">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === active.id}
            aria-label={t.label}
            title={t.label}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-lg transition-colors ${
              t.id === active.id ? "bg-surface shadow-[inset_0_-2px_0_var(--accent)]" : "opacity-70 hover:opacity-100"
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-text-faint">{active.label}</p>
      <div className="grid h-52 grid-cols-8 content-start gap-0.5 overflow-y-auto p-2">
        {active.emojis.length === 0 && (
          <p className="col-span-8 py-6 text-center text-xs text-text-faint">Os emojis que você usar aparecem aqui.</p>
        )}
        {active.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => pick(emoji)}
            className="flex h-9 w-full items-center justify-center rounded-lg text-xl transition-colors hover:bg-surface-2"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
