import type { WeekGrid } from "@/lib/agendaWeek";

/** Nome do arquivo: agenda-26-10-a-01-11.pdf */
export function weekFileName(grid: Pick<WeekGrid, "rangeLabel">): string {
  return `agenda-${grid.rangeLabel.replace(/\//g, "-").replace(/ a /, "-a-")}.pdf`;
}

/** Logo já carregada (no navegador, um <img>; em teste, um data URL) com o tamanho original. */
export type PdfLogo = { data: string | HTMLImageElement; width: number; height: number };

// Página A4 deitada, no formato da agenda impressa da Simbora.
const MARGIN_X = 50;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 36;
const LOGO_BOX_H = 54;
const LOGO_MAX_H = 40;
const TITLE_H = 17;
const WEEK_H = 14;
const HEADER_H = 22;
const MIN_ROW_H = 24;
const TIME_COL_W = 36;
const CELL_PAD = 3;

const BLUE_BAR: [number, number, number] = [126, 171, 232];
const BLUE_HEADER: [number, number, number] = [189, 215, 238];
const BLUE_CELL: [number, number, number] = [220, 230, 241];
const GRID_LINE: [number, number, number] = [138, 190, 164];

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function buildAgendaPdfDoc(grid: WeekGrid, logo: PdfLogo | null = null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const tableW = pageW - MARGIN_X * 2;
  const dayW = (tableW - TIME_COL_W) / 7;
  const colX = (i: number) => MARGIN_X + TIME_COL_W + dayW * i;

  const outerStroke = () => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
  };
  const gridStroke = () => {
    doc.setDrawColor(...GRID_LINE);
    doc.setLineWidth(0.5);
  };

  let y = MARGIN_TOP;

  // Cabeçalho da 1ª página: logo, título e semana.
  outerStroke();
  doc.setFillColor(255, 255, 255);
  doc.rect(MARGIN_X, y, tableW, LOGO_BOX_H, "FD");
  if (logo) {
    const scale = Math.min(LOGO_MAX_H / logo.height, 1);
    const w = logo.width * scale;
    const h = logo.height * scale;
    doc.addImage(logo.data, "PNG", (pageW - w) / 2, y + (LOGO_BOX_H - h) / 2, w, h);
  }
  y += LOGO_BOX_H;

  doc.setFillColor(...BLUE_BAR);
  doc.rect(MARGIN_X, y, tableW, TITLE_H, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(20, 20, 20);
  doc.text("Agenda da Semana", pageW / 2, y + TITLE_H / 2 + 3, { align: "center" });
  y += TITLE_H;

  doc.setFillColor(...BLUE_BAR);
  doc.rect(MARGIN_X, y, tableW, WEEK_H, "FD");
  doc.setFontSize(7);
  doc.text(`Semana: ${grid.rangeLabel}`, MARGIN_X + 2, y + WEEK_H / 2 + 2.5);
  y += WEEK_H;

  function drawHeaderRow() {
    gridStroke();
    doc.setFillColor(...BLUE_HEADER);
    doc.rect(MARGIN_X, y, TIME_COL_W, HEADER_H, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(20, 20, 20);
    doc.text("Hora", MARGIN_X + TIME_COL_W / 2, y + HEADER_H / 2 + 2.3, { align: "center" });
    grid.days.forEach((day, i) => {
      doc.setFillColor(...BLUE_HEADER);
      doc.rect(colX(i), y, dayW, HEADER_H, "FD");
      doc.setFontSize(8);
      doc.text(day.label, colX(i) + dayW / 2, y + HEADER_H / 2 + 2.8, { align: "center" });
    });
    y += HEADER_H;
  }

  drawHeaderRow();

  const textW = dayW - CELL_PAD * 2;
  for (const row of grid.rows) {
    // Quebra o texto de cada compromisso e mede a linha pela célula mais alta.
    const blocks = row.cells.map((cell) =>
      cell.map((event) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        const title: string[] = doc.splitTextToSize(event.title, textW);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        const detail: string[] = doc.splitTextToSize(event.detail, textW);
        return { title, detail, height: title.length * 8.4 + detail.length * 7.2 + 3 };
      }),
    );
    const contentH = Math.max(0, ...blocks.map((b) => b.reduce((sum, x) => sum + x.height, 0)));
    const rowH = Math.max(MIN_ROW_H, contentH + CELL_PAD * 2);

    if (y + rowH > pageH - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
      drawHeaderRow();
    }

    gridStroke();
    doc.setFillColor(...BLUE_CELL);
    doc.rect(MARGIN_X, y, TIME_COL_W, rowH, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(20, 20, 20);
    doc.text(row.time, MARGIN_X + TIME_COL_W / 2, y + rowH / 2 + 2, { align: "center" });

    blocks.forEach((cell, i) => {
      gridStroke();
      doc.setFillColor(...BLUE_CELL);
      doc.rect(colX(i), y, dayW, rowH, "FD");
      let cy = y + CELL_PAD + 6;
      for (const block of cell) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(20, 20, 20);
        block.title.forEach((line, n) => doc.text(line, colX(i) + CELL_PAD, cy + n * 8.4));
        cy += block.title.length * 8.4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.setTextColor(80, 80, 80);
        block.detail.forEach((line, n) => doc.text(line, colX(i) + CELL_PAD, cy - 1 + n * 7.2));
        cy += block.detail.length * 7.2 + 3;
      }
    });

    y += rowH;
  }

  // Moldura externa por cima da tabela, como no modelo.
  outerStroke();
  doc.rect(MARGIN_X, MARGIN_TOP, tableW, y - MARGIN_TOP);

  return doc;
}

// A logo aparece com ~40pt de altura; 2x disso já fica nítido e mantém o arquivo leve.
const LOGO_EMBED_HEIGHT = 160;

/** Logo do CRM reduzida pro tamanho de uso (o PNG original embutido inteiro deixava o PDF com ~1 MB). */
async function loadLogo(): Promise<PdfLogo> {
  const img = await loadImage("/logo.png");
  const scale = Math.min(LOGO_EMBED_HEIGHT / img.naturalHeight, 1);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
  return { data: canvas.toDataURL("image/png"), width, height };
}

/** Gera e baixa o PDF da semana (usa /logo.png do CRM no cabeçalho). */
export async function exportAgendaToPdf(grid: WeekGrid): Promise<void> {
  let logo: PdfLogo | null = null;
  try {
    logo = await loadLogo();
  } catch {
    // sem logo: o PDF sai igual, só com o cabeçalho vazio
  }
  const doc = await buildAgendaPdfDoc(grid, logo);
  doc.save(weekFileName(grid));
}
