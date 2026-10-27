import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildAgendaPdfDoc } from "../lib/agendaPdf.ts";
import { buildWeekGrid } from "../lib/agendaWeek.ts";
import type { AgendaEvent } from "../types/agenda.ts";

const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();
const event = (id: number, title: string, start: string, end: string): AgendaEvent => ({
  id, title, description: null, starts_at: start, ends_at: end, created_by: 1, created_by_name: "Leonardo",
  participants: [{ id: 1, full_name: "Ana Souza", photo_url: null }],
});

test("gera um PDF A4 deitado de 1 página, com logo", async () => {
  const grid = buildWeekGrid([event(1, "Ibérico Tio Armênio (captação)", at(2026, 10, 26, 16), at(2026, 10, 26, 17))], "2026-10-26");
  const png = readFileSync(new URL("../public/logo.png", import.meta.url));
  const doc = await buildAgendaPdfDoc(grid, { data: `data:image/png;base64,${png.toString("base64")}`, width: 600, height: 450 });

  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight(), "página deitada");
  const bytes = Buffer.from(doc.output("arraybuffer"));
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  assert.ok(bytes.length > 10_000, "inclui a logo");
});

test("funciona sem logo", async () => {
  const doc = await buildAgendaPdfDoc(buildWeekGrid([], "2026-10-26"), null);
  assert.equal(doc.getNumberOfPages(), 1);
});

test("semana cheia de compromissos vira várias páginas, sem perder nenhum", async () => {
  const many = Array.from({ length: 60 }, (_, i) =>
    event(i + 1, `Compromisso ${i + 1} com um título bem comprido pra quebrar linha`, at(2026, 10, 26 + (i % 7), 8 + (i % 12), (i % 2) * 30), at(2026, 10, 26 + (i % 7), 9 + (i % 12), 0)),
  );
  const grid = buildWeekGrid(many, "2026-10-26");
  const placed = grid.rows.flatMap((r) => r.cells.flat()).length;
  assert.equal(placed, 60);
  const doc = await buildAgendaPdfDoc(grid, null);
  assert.ok(doc.getNumberOfPages() > 1);
});
