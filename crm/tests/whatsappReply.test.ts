import assert from "node:assert/strict";
import { test } from "node:test";
import { insertAtCursor, quoteAuthor, replyTargetOf } from "../lib/whatsappReply.ts";
import type { WhatsAppMessage } from "../types/whatsapp.ts";

const base: WhatsAppMessage = {
  id: "A1",
  remote_jid: "5511999999999@s.whatsapp.net",
  from_me: false,
  text: "Oi, tudo bem?",
  timestamp: 1,
  sender_name: "Carol",
  media_type: null,
  media_mimetype: null,
};

test("quoteAuthor: nossa mensagem é 'Você', senão o autor, senão o nome da conversa", () => {
  assert.equal(quoteAuthor({ reply_from_me: true, reply_author: "Carol" }, "Cliente"), "Você");
  assert.equal(quoteAuthor({ reply_from_me: false, reply_author: " Carol " }, "Cliente"), "Carol");
  assert.equal(quoteAuthor({ reply_from_me: null, reply_author: null }, "Cliente"), "Cliente");
});

test("replyTargetOf: texto, mídia sem legenda e mensagem sem id", () => {
  assert.deepEqual(replyTargetOf(base, "Cliente"), { id: "A1", author: "Carol", text: "Oi, tudo bem?" });
  assert.deepEqual(replyTargetOf({ ...base, from_me: true, text: null, media_type: "image" }, "Cliente"), {
    id: "A1",
    author: "Você",
    text: "📷 Foto",
  });
  assert.equal(replyTargetOf({ ...base, id: null }, "Cliente"), null);
});

test("insertAtCursor: no cursor, no lugar da seleção e com índices fora do texto", () => {
  assert.deepEqual(insertAtCursor("Olá ", 4, 4, "😀"), { text: "Olá 😀", cursor: 6 });
  assert.deepEqual(insertAtCursor("Olá mundo", 4, 9, "😀"), { text: "Olá 😀", cursor: 6 });
  assert.deepEqual(insertAtCursor("ab", 99, 99, "😀"), { text: "ab😀", cursor: 4 });
});
