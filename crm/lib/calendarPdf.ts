import type { CalendarEntry } from "@/types/calendar";

const DIAS_SEMANA = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

function formatDateHeader(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}, ${DIAS_SEMANA[date.getDay()]}`;
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

const PAGE_MARGIN = 40;
const LINE_HEIGHT = 14;
const CELL_PADDING = 8;
const HEADER_ROW_HEIGHT = 24;
const LOGO_MAX_WIDTH = 160;
const LOGO_MAX_HEIGHT = 64;

const COL_WIDTHS = {
  data: 110,
};

export async function exportCalendarToPdf(
  clientName: string,
  monthLabel: string,
  entries: CalendarEntry[],
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const tableWidth = pageWidth - PAGE_MARGIN * 2;

  const remaining = tableWidth - COL_WIDTHS.data;
  const colX = {
    data: PAGE_MARGIN,
    descricao: PAGE_MARGIN + COL_WIDTHS.data,
    execucao: PAGE_MARGIN + COL_WIDTHS.data + remaining / 2,
  };
  const colWidths = {
    data: COL_WIDTHS.data,
    descricao: remaining / 2,
    execucao: remaining / 2,
  };

  let y = PAGE_MARGIN;

  // Cabeçalho — logo da Simbora centralizada + título
  try {
    const logo = await loadImage("/logo.png");
    const scale = Math.min(LOGO_MAX_WIDTH / logo.naturalWidth, LOGO_MAX_HEIGHT / logo.naturalHeight, 1);
    const logoW = logo.naturalWidth * scale;
    const logoH = logo.naturalHeight * scale;
    doc.addImage(logo, "PNG", (pageWidth - logoW) / 2, y, logoW, logoH);
    y += logoH + 20;
  } catch {
    // Sem logo disponível — segue sem quebrar a exportação.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.21); // 15 * 0.7475 — 35% menor, depois +15% sobre isso
  doc.setTextColor(20, 20, 20);
  doc.text("CRONOGRAMA DE POSTAGEM", pageWidth / 2, y, { align: "center" });
  y += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.22); // 11 * 0.7475
  doc.setTextColor(90, 90, 90);
  doc.text(`${clientName}, ${monthLabel.toUpperCase()}`, pageWidth / 2, y, { align: "center" });
  y += 26;

  const ordenados = [...entries].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

  if (ordenados.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.22); // 11 * 0.7475
    doc.setTextColor(120, 120, 120);
    doc.text("Nenhuma postagem planejada neste mês.", PAGE_MARGIN, y);
    doc.save(`cronograma-${slugify(clientName)}-${slugify(monthLabel)}.pdf`);
    return;
  }

  function drawHeaderRow() {
    doc.setFillColor(240, 240, 243);
    doc.rect(PAGE_MARGIN, y, tableWidth, HEADER_ROW_HEIGHT, "F");
    doc.setDrawColor(200, 200, 200);
    doc.rect(colX.data, y, colWidths.data, HEADER_ROW_HEIGHT);
    doc.rect(colX.descricao, y, colWidths.descricao, HEADER_ROW_HEIGHT);
    doc.rect(colX.execucao, y, colWidths.execucao, HEADER_ROW_HEIGHT);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.48); // 10 * 0.7475
    doc.setTextColor(0, 0, 0);
    doc.text("Data", colX.data + CELL_PADDING, y + HEADER_ROW_HEIGHT / 2 + 3);
    doc.text("Descrição", colX.descricao + CELL_PADDING, y + HEADER_ROW_HEIGHT / 2 + 3);
    doc.text("Execução", colX.execucao + CELL_PADDING, y + HEADER_ROW_HEIGHT / 2 + 3);

    y += HEADER_ROW_HEIGHT;
  }

  function ensureSpace(needed: number) {
    if (y + needed > pageHeight - PAGE_MARGIN) {
      doc.addPage();
      y = PAGE_MARGIN;
      drawHeaderRow();
    }
  }

  drawHeaderRow();

  for (const entry of ordenados) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.73); // 9 * 0.7475

    const dataLines: string[] = doc.splitTextToSize(
      formatDateHeader(entry.scheduled_date),
      colWidths.data - CELL_PADDING * 2,
    );
    const descricaoLines: string[] = doc.splitTextToSize(entry.theme, colWidths.descricao - CELL_PADDING * 2);
    const execucaoLines: string[] = doc.splitTextToSize(
      entry.execution_notes || "",
      colWidths.execucao - CELL_PADDING * 2,
    );
    const lineCount = Math.max(dataLines.length, descricaoLines.length, execucaoLines.length, 1);
    const rowHeight = Math.max(lineCount * LINE_HEIGHT + CELL_PADDING * 2, HEADER_ROW_HEIGHT);

    ensureSpace(rowHeight);

    const rowTop = y;

    doc.setDrawColor(220, 220, 220);
    doc.rect(colX.data, rowTop, colWidths.data, rowHeight);
    doc.rect(colX.descricao, rowTop, colWidths.descricao, rowHeight);
    doc.rect(colX.execucao, rowTop, colWidths.execucao, rowHeight);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.73); // 9 * 0.7475
    doc.setTextColor(0, 0, 0);
    dataLines.forEach((line: string, i: number) => {
      doc.text(line, colX.data + CELL_PADDING, rowTop + CELL_PADDING + LINE_HEIGHT * (i + 1) - 3);
    });

    descricaoLines.forEach((line: string, i: number) => {
      doc.text(line, colX.descricao + CELL_PADDING, rowTop + CELL_PADDING + LINE_HEIGHT * (i + 1) - 3);
    });

    execucaoLines.forEach((line: string, i: number) => {
      doc.text(line, colX.execucao + CELL_PADDING, rowTop + CELL_PADDING + LINE_HEIGHT * (i + 1) - 3);
    });

    y = rowTop + rowHeight;
  }

  doc.save(`cronograma-${slugify(clientName)}-${slugify(monthLabel)}.pdf`);
}
