import { splitLinks } from "@/lib/links";

type Props = {
  text: string;
  className?: string;
};

/** Texto com os links clicáveis (abrem em nova aba). Para texto só de leitura. */
export default function Linkify({ text, className }: Props) {
  return (
    <span className={className}>
      {splitLinks(text).map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            // Dentro de card clicável/arrastável: o clique no link só abre o link.
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="break-all text-accent underline underline-offset-2 hover:opacity-80"
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        ),
      )}
    </span>
  );
}
