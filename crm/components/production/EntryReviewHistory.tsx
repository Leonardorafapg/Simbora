"use client";

import { useEffect, useState } from "react";
import type { CalendarEntryReview } from "@/types/calendar";
import { fetchEntryReviews } from "@/services/client/calendarApi";

type Props = {
  entryId: number;
  /** Muda quando o post muda de coluna, pra recarregar o histórico. */
  status: string;
  members: { id: number; full_name: string }[];
};

/** Quem aprovou ou pediu ajustes no post, e por quê (mais recente primeiro). Some se nunca foi revisado. */
export default function EntryReviewHistory({ entryId, status, members }: Props) {
  const [reviews, setReviews] = useState<CalendarEntryReview[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchEntryReviews(entryId)
      .then((data) => !cancelled && setReviews(data))
      .catch(() => !cancelled && setReviews([]));
    return () => {
      cancelled = true;
    };
  }, [entryId, status]);

  if (reviews.length === 0) return null;

  return (
    <section className="space-y-2 rounded-xl border border-border bg-surface-2/40 p-4">
      <h3 className="text-sm font-semibold text-text">Revisões</h3>
      <ul className="space-y-2">
        {reviews.map((review) => {
          const who = members.find((m) => m.id === review.decided_by_user_id)?.full_name ?? "Revisão";
          const approved = review.decision === "aprovado";
          return (
            <li key={review.id} className="text-sm">
              <span className={approved ? "font-semibold text-emerald-500" : "font-semibold text-amber-500"}>
                {approved ? "Aprovado" : "Ajustes pedidos"}
              </span>
              <span className="text-text-muted">
                {" "}
                por {who} em {new Date(review.decided_at + (review.decided_at.endsWith("Z") ? "" : "Z")).toLocaleString("pt-BR")}
              </span>
              {review.reason && <p className="mt-0.5 whitespace-pre-wrap text-text">{review.reason}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
