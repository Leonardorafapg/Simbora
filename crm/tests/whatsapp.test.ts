import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRows, chatTitle, formatChatTime, formatFileSize, previewOf, senderColor, toDate, upsertMessage } from "../lib/whatsapp.ts";
import type { WhatsAppMessage } from "../types/whatsapp.ts";

const msg = (over: Partial<WhatsAppMessage>): WhatsAppMessage => ({
  id: null, remote_jid: "x@s.whatsapp.net", from_me: false, text: "oi", timestamp: 1_700_000_000,
  sender_name: null, media_type: null, media_mimetype: null, ...over,
});

test("previewOf: texto, mídia com legenda e mídia sem legenda", () => {
  assert.equal(previewOf({ text: "oi", media_type: null }), "oi");
  assert.equal(previewOf({ text: null, media_type: "image" }), "📷 Foto");
  assert.equal(previewOf({ text: "veja", media_type: "image" }), "📷 veja");
  assert.equal(previewOf({ text: null, media_type: "document" }), "📄 Documento");
  assert.equal(previewOf({ text: null, media_type: null }), null);
});

test("toDate entende epoch em segundos, string numérica e ISO", () => {
  assert.equal(toDate(1_700_000_000)?.getTime(), 1_700_000_000_000);
  assert.equal(toDate("1700000000")?.getTime(), 1_700_000_000_000);
  assert.equal(toDate("2026-10-22T10:00:00Z")?.toISOString(), "2026-10-22T10:00:00.000Z");
  assert.equal(toDate(null), null);
  assert.equal(toDate("lixo"), null);
});

test("formatChatTime: hoje mostra hora, ontem, e data completa depois de uma semana", () => {
  const now = new Date(2026, 9, 22, 15, 0);
  assert.equal(formatChatTime(new Date(2026, 9, 22, 9, 5).getTime() / 1000, now), "09:05");
  assert.equal(formatChatTime(new Date(2026, 9, 21, 23, 0).getTime() / 1000, now), "Ontem");
  assert.equal(formatChatTime(new Date(2026, 8, 1, 10, 0).getTime() / 1000, now), "01/09/26");
  assert.equal(formatChatTime(null, now), "");
});

test("formatFileSize", () => {
  assert.equal(formatFileSize(512), "512 B");
  assert.equal(formatFileSize(2048), "2 KB");
  assert.equal(formatFileSize(5 * 1024 * 1024), "5,0 MB");
});

test("upsertMessage ignora o mesmo id (resposta HTTP + WebSocket)", () => {
  const a = msg({ id: "A" });
  assert.equal(upsertMessage([a], msg({ id: "A" })).length, 1);
  assert.equal(upsertMessage([a], msg({ id: "B" })).length, 2);
  assert.equal(upsertMessage([a], msg({ id: null })).length, 2);
});

test("buildRows: separador de dia e agrupamento por remetente", () => {
  const t = new Date(2026, 9, 22, 10, 0).getTime() / 1000;
  const rows = buildRows(
    [msg({ id: "1", timestamp: t }), msg({ id: "2", timestamp: t + 60 }), msg({ id: "3", timestamp: t + 120, from_me: true })],
    new Date(2026, 9, 22, 12, 0),
  );
  assert.equal(rows[0].type, "day");
  const [, m1, m2, m3] = rows as Extract<(typeof rows)[number], { type: "message" }>[];
  assert.deepEqual([m1.first, m1.last], [true, false]);
  assert.deepEqual([m2.first, m2.last], [false, true]);
  assert.deepEqual([m3.first, m3.last], [true, true]);
});

test("buildRows: intervalo grande quebra o grupo", () => {
  const t = new Date(2026, 9, 22, 10, 0).getTime() / 1000;
  const rows = buildRows([msg({ id: "1", timestamp: t }), msg({ id: "2", timestamp: t + 3600 })]);
  const messages = rows.filter((r) => r.type === "message");
  assert.equal((messages[1] as { first: boolean }).first, true);
});

test("senderColor é estável", () => {
  assert.equal(senderColor("Ana"), senderColor("Ana"));
});

test("chatTitle nunca devolve o JID cru", () => {
  assert.equal(chatTitle({ name: "120363@g.us", remote_jid: "120363@g.us", is_group: true }), "Grupo sem nome");
  assert.equal(chatTitle({ name: null, remote_jid: "45@lid", is_group: false }), "Contato sem número");
  assert.equal(chatTitle({ name: null, remote_jid: "55@s.whatsapp.net", is_group: false, phone: "+55 16 3523-0764" }), "+55 16 3523-0764");
  assert.equal(chatTitle({ name: "Equipe MKT", remote_jid: "1@g.us", is_group: true }), "Equipe MKT");
});
