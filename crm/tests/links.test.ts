import assert from "node:assert/strict";
import { test } from "node:test";
import { extractLinks, linkLabel, normalizeUrl, splitLinks } from "../lib/links.ts";

test("normalizeUrl adiciona https e rejeita o que não é link", () => {
  assert.equal(normalizeUrl(" drive.google.com/drive/folders/abc "), "https://drive.google.com/drive/folders/abc");
  assert.equal(normalizeUrl("http://exemplo.com"), "http://exemplo.com");
  assert.equal(normalizeUrl("javascript:alert(1)"), null);
  assert.equal(normalizeUrl("mailto:a@b.com"), null);
  assert.equal(normalizeUrl("ftp://x.com/a"), null);
  assert.equal(normalizeUrl("duas palavras.com"), null);
  assert.equal(normalizeUrl("semponto"), null);
  assert.equal(normalizeUrl(""), null);
});

test("linkLabel mostra o nome do serviço ou o domínio", () => {
  assert.equal(linkLabel("https://drive.google.com/drive/folders/abc"), "Google Drive");
  assert.equal(linkLabel("https://www.figma.com/file/1"), "Figma");
  assert.equal(linkLabel("https://www.exemplo.com.br/a"), "exemplo.com.br");
});

test("splitLinks separa texto e links, sem levar a pontuação final", () => {
  assert.deepEqual(splitLinks("Veja https://drive.google.com/x. Obrigado!"), [
    { type: "text", value: "Veja " },
    { type: "link", value: "https://drive.google.com/x", href: "https://drive.google.com/x" },
    { type: "text", value: ". Obrigado!" },
  ]);
});

test("splitLinks entende www. e texto sem link", () => {
  assert.deepEqual(splitLinks("www.site.com/a"), [{ type: "link", value: "www.site.com/a", href: "https://www.site.com/a" }]);
  assert.deepEqual(splitLinks("sem link aqui"), [{ type: "text", value: "sem link aqui" }]);
  assert.deepEqual(splitLinks(""), []);
});

test("extractLinks não repete", () => {
  assert.deepEqual(extractLinks("https://a.com e de novo https://a.com e https://b.com"), ["https://a.com", "https://b.com"]);
});
