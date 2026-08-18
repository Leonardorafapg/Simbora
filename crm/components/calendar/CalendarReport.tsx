"use client";

import { useState } from "react";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import type { CalendarEntry } from "@/types/calendar";
import { exportCalendarToPdf } from "@/lib/calendarPdf";

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function formatDateCell(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}, ${DIAS_SEMANA[date.getDay()]}`;
}

type Props = {
  clientName: string;
  monthLabel: string;
  entries: CalendarEntry[];
  onClose: () => void;
};

export default function CalendarReport({ clientName, monthLabel, entries, onClose }: Props) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const ordenados = [...entries].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  async function handleExportPdf() {
    setExportError(null);
    setExporting(true);
    try {
      await exportCalendarToPdf(clientName, monthLabel, ordenados);
    } catch {
      setExportError("Falha ao gerar o PDF.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div data-print-area className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-white/60 hover:text-white flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao calendário
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 flex items-center gap-1.5"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir
          </button>
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={exporting}
            className="rounded-lg bg-cyan px-3 py-2 text-xs font-semibold text-black hover:bg-cyan-dark disabled:opacity-60 flex items-center gap-1.5"
          >
            <FileDown className="h-3.5 w-3.5" /> {exporting ? "Gerando PDF..." : "Exportar PDF"}
          </button>
        </div>
      </div>

      {exportError && <p className="text-sm text-danger">{exportError}</p>}

      <div className="flex flex-col items-center text-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- asset estático simples, sem necessidade de otimização */}
        <img src="/logo.png" alt="Simbora" className="h-10 w-auto" />
        <div>
          <h3 className="font-semibold text-white">Cronograma de Postagem</h3>
          <p className="text-xs uppercase tracking-wider text-white/40 mt-0.5">
            {clientName}, {monthLabel}
          </p>
        </div>
      </div>

      {ordenados.length === 0 ? (
        <p className="text-sm text-white/50">Nenhuma postagem planejada neste mês.</p>
      ) : (
        <div className="rounded-xl border border-white/10 overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/5 text-left text-[11px] uppercase tracking-wider text-white/40">
                <th className="px-3 py-2 font-medium w-[160px]">Data</th>
                <th className="px-3 py-2 font-medium">Descrição</th>
                <th className="px-3 py-2 font-medium">Execução</th>
              </tr>
            </thead>
            <tbody>
              {ordenados.map((entry) => (
                <tr key={entry.id} className="border-t border-white/5">
                  <td className="px-3 py-2 align-top text-white/70 whitespace-nowrap">
                    {formatDateCell(entry.scheduled_date)}
                  </td>
                  <td className="px-3 py-2 align-top text-white">{entry.theme}</td>
                  <td className="px-3 py-2 align-top text-white/70">{entry.execution_notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
