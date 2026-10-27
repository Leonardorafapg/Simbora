import assert from "node:assert/strict";
import { test } from "node:test";
import { weekFileName } from "../lib/agendaPdf.ts";
import { addDays, buildWeekGrid, DEFAULT_TIMES, weekStartOf, weekWindow } from "../lib/agendaWeek.ts";
import type { AgendaEvent } from "../types/agenda.ts";

// Horários montados no fuso local da máquina — os testes valem em qualquer fuso.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

const event = (id: number, title: string, start: string, end: string, names: string[] = []): AgendaEvent => ({
  id, title, description: null, starts_at: start, ends_at: end, created_by: 1, created_by_name: "Leonardo",
  participants: names.map((full_name, i) => ({ id: i + 1, full_name, photo_url: null })),
});

const WEEK = "2026-10-26"; // segunda

const cellOf = (grid: ReturnType<typeof buildWeekGrid>, time: string, dayIndex: number) =>
  grid.rows.find((r) => r.time === time)?.cells[dayIndex] ?? [];

test("weekStartOf devolve a segunda-feira da semana (domingo fecha a semana)", () => {
  assert.equal(weekStartOf("2026-10-28"), "2026-10-26"); // quarta
  assert.equal(weekStartOf("2026-10-26"), "2026-10-26"); // segunda
  assert.equal(weekStartOf("2026-11-01"), "2026-10-26"); // domingo
  assert.equal(weekStartOf("2026-11-02"), "2026-11-02");
});

test("addDays atravessa mês e ano", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});

test("weekWindow cobre de segunda 00:00 até a próxima segunda 00:00", () => {
  const { start, end } = weekWindow(WEEK);
  assert.equal(start, at(2026, 10, 26));
  assert.equal(end, at(2026, 11, 2));
});

test("cabeçalho: sete dias com nome e número, e o intervalo da semana", () => {
  const grid = buildWeekGrid([], WEEK);
  assert.deepEqual(grid.days.map((d) => d.label), [
    "Segunda 26", "Terça 27", "Quarta 28", "Quinta 29", "Sexta 30", "Sábado 31", "Domingo 01",
  ]);
  assert.equal(grid.rangeLabel, "26/10 a 01/11");
  assert.equal(grid.weekEnd, "2026-11-01");
});

test("sem compromissos a grade tem só os horários padrão e células vazias", () => {
  const grid = buildWeekGrid([], WEEK);
  assert.deepEqual(grid.rows.map((r) => r.time), DEFAULT_TIMES);
  assert.ok(grid.rows.every((r) => r.cells.length === 7 && r.cells.every((c) => c.length === 0)));
});

test("compromisso cai na linha do horário e na coluna do dia", () => {
  const grid = buildWeekGrid([event(1, "Ibérico (captação)", at(2026, 10, 26, 16), at(2026, 10, 26, 17))], WEEK);
  const [item] = cellOf(grid, "16:00", 0);
  assert.equal(item.title, "Ibérico (captação)");
  assert.equal(item.detail, "até 17:00");
  assert.equal(cellOf(grid, "16:00", 1).length, 0);
});

test("horário fora da grade padrão ganha uma linha própria, na ordem", () => {
  const grid = buildWeekGrid([event(1, "Reunião", at(2026, 10, 27, 12, 30), at(2026, 10, 27, 13, 30))], WEEK);
  const times = grid.rows.map((r) => r.time);
  assert.ok(times.includes("12:30"));
  assert.deepEqual(times, [...times].sort());
  assert.equal(cellOf(grid, "12:30", 1)[0].title, "Reunião");
});

test("dois compromissos no mesmo horário e dia ficam empilhados", () => {
  const grid = buildWeekGrid(
    [event(1, "A", at(2026, 10, 28, 10), at(2026, 10, 28, 11)), event(2, "B", at(2026, 10, 28, 10), at(2026, 10, 28, 11))],
    WEEK,
  );
  assert.deepEqual(cellOf(grid, "10:00", 2).map((e) => e.title), ["A", "B"]);
});

test("só aparecem os marcados (quem criou não conta), pelo primeiro nome", () => {
  const grid = buildWeekGrid(
    [event(1, "Alinhamento", at(2026, 10, 28, 9), at(2026, 10, 28, 10), ["Ana Souza", "Bia Lima"])],
    WEEK,
  );
  assert.equal(cellOf(grid, "09:00", 2)[0].detail, "até 10:00 • Ana, Bia");
});

test("compromisso de vários dias aparece em cada dia (no início e na 1ª linha dos seguintes)", () => {
  const grid = buildWeekGrid([event(1, "Viagem", at(2026, 10, 28, 14), at(2026, 10, 30, 9))], WEEK);
  assert.equal(cellOf(grid, "14:00", 2)[0].detail, "até 30/10 09:00");
  assert.equal(grid.rows[0].cells[3][0].title, "Viagem");
  assert.equal(grid.rows[0].cells[3][0].detail, "continuação • o dia todo");
  assert.equal(grid.rows[0].cells[4][0].detail, "continuação • até 09:00");
  assert.equal(grid.rows[0].cells[5].length, 0);
});

test("compromisso de outra semana é ignorado", () => {
  const grid = buildWeekGrid(
    [event(1, "Passada", at(2026, 10, 20, 10), at(2026, 10, 20, 11)), event(2, "Próxima", at(2026, 11, 2, 10), at(2026, 11, 2, 11))],
    WEEK,
  );
  assert.ok(grid.rows.every((r) => r.cells.every((c) => c.length === 0)));
  assert.equal(grid.rows.length, DEFAULT_TIMES.length); // nem cria linha pro horário deles
});

test("compromisso que termina à meia-noite de segunda não entra na semana anterior no domingo seguinte", () => {
  const grid = buildWeekGrid([event(1, "Noite", at(2026, 10, 25, 22), at(2026, 10, 26, 0))], WEEK);
  assert.ok(grid.rows.every((r) => r.cells.every((c) => c.length === 0)));
});

test("weekFileName", () => {
  assert.equal(weekFileName({ rangeLabel: "26/10 a 01/11" }), "agenda-26-10-a-01-11.pdf");
});

test("um único marcado também aparece; sem ninguém marcado só o horário", () => {
  const one = buildWeekGrid([event(1, "Reunião", at(2026, 10, 28, 9), at(2026, 10, 28, 10), ["Bia Lima"])], WEEK);
  assert.equal(cellOf(one, "09:00", 2)[0].detail, "até 10:00 • Bia");
  const none = buildWeekGrid([event(2, "Sozinho", at(2026, 10, 28, 9), at(2026, 10, 28, 10))], WEEK);
  assert.equal(cellOf(none, "09:00", 2)[0].detail, "até 10:00");
});
