import assert from "node:assert/strict";
import { test } from "node:test";
import { dayKey, eventsByDay, overlapsMonth, formatEventRange, fromLocalInput, monthCells, monthWindow, timeAgo, toLocalInput } from "../lib/agenda.ts";
import type { AgendaEvent } from "../types/agenda.ts";

// Datas montadas no fuso local da máquina — os testes valem em qualquer fuso.
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

const event = (id: number, start: string, end: string): AgendaEvent => ({
  id, title: `E${id}`, description: null, starts_at: start, ends_at: end, created_by: 1, participants: [],
});

test("toLocalInput e fromLocalInput se desfazem", () => {
  const iso = at(2026, 10, 28, 14, 30);
  assert.equal(toLocalInput(iso), "2026-10-28T14:30");
  assert.equal(fromLocalInput("2026-10-28T14:30"), iso);
});

test("monthWindow cobre o mês inteiro e só ele", () => {
  const { start, end } = monthWindow(2026, 12);
  assert.equal(start, at(2026, 12, 1));
  assert.equal(end, at(2027, 1, 1));
});

test("monthCells começa no dia da semana certo e completa as semanas", () => {
  const cells = monthCells(2026, 10); // 1º/out/2026 é quinta
  assert.equal(cells.indexOf(1), 4);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter((c) => c !== null).length, 31);
});

test("eventsByDay agrupa por dia e ordena pelo início", () => {
  const map = eventsByDay([
    event(2, at(2026, 10, 28, 16), at(2026, 10, 28, 17)),
    event(1, at(2026, 10, 28, 9), at(2026, 10, 28, 10)),
  ]);
  assert.deepEqual(map.get("2026-10-28")?.map((e) => e.id), [1, 2]);
});

test("compromisso de vários dias aparece em cada dia", () => {
  const map = eventsByDay([event(1, at(2026, 10, 28, 22), at(2026, 10, 30, 8))]);
  assert.deepEqual([...map.keys()], ["2026-10-28", "2026-10-29", "2026-10-30"]);
});

test("fim à meia-noite não vaza pro dia seguinte", () => {
  const map = eventsByDay([event(1, at(2026, 10, 28, 22), at(2026, 10, 29, 0))]);
  assert.deepEqual([...map.keys()], ["2026-10-28"]);
});

test("formatEventRange: mesmo dia e dias diferentes", () => {
  assert.equal(formatEventRange({ starts_at: at(2026, 10, 28, 14), ends_at: at(2026, 10, 28, 15, 30) }), "14:00 – 15:30");
  assert.equal(formatEventRange({ starts_at: at(2026, 10, 28, 14), ends_at: at(2026, 10, 29, 10) }), "28/10 14:00 – 29/10 10:00");
});

test("timeAgo", () => {
  const now = new Date(2026, 9, 28, 15, 0);
  assert.equal(timeAgo(new Date(2026, 9, 28, 14, 59, 40).toISOString(), now), "agora");
  assert.equal(timeAgo(new Date(2026, 9, 28, 14, 55).toISOString(), now), "há 5 min");
  assert.equal(timeAgo(new Date(2026, 9, 28, 12, 0).toISOString(), now), "há 3 h");
  assert.equal(timeAgo(new Date(2026, 9, 27, 23, 0).toISOString(), now), "ontem");
  assert.equal(timeAgo(new Date(2026, 9, 20, 10, 0).toISOString(), now), "20/10/26");
});

test("dayKey usa o fuso local", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
});

test("overlapsMonth: dentro, fora e atravessando a virada do mês", () => {
  const inOct = { starts_at: at(2026, 10, 28, 9), ends_at: at(2026, 10, 28, 10) };
  assert.equal(overlapsMonth(inOct, 2026, 10), true);
  assert.equal(overlapsMonth(inOct, 2026, 11), false);
  const crossing = { starts_at: at(2026, 10, 31, 22), ends_at: at(2026, 11, 1, 2) };
  assert.equal(overlapsMonth(crossing, 2026, 10), true);
  assert.equal(overlapsMonth(crossing, 2026, 11), true);
});
