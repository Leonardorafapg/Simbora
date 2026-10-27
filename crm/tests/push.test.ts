import assert from "node:assert/strict";
import { test } from "node:test";
import { pushState, urlBase64ToUint8Array, type PushEnv } from "../lib/push.ts";

const base: PushEnv = { supported: true, serverEnabled: true, isIos: false, standalone: false, permission: "default", subscribed: false };

test("urlBase64ToUint8Array decodifica a chave VAPID (65 bytes, começa em 0x04)", () => {
  // chave pública de exemplo no formato base64 url-safe sem "=" (65 bytes)
  const raw = new Uint8Array(65).fill(7);
  raw[0] = 4;
  const encoded = Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const bytes = urlBase64ToUint8Array(encoded);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4);
  assert.deepEqual([...bytes], [...raw]);
});

test("urlBase64ToUint8Array lida com caracteres url-safe (- e _)", () => {
  assert.deepEqual([...urlBase64ToUint8Array("-_8")], [0xfb, 0xff]);
});

test("pushState: pode ativar quando está tudo certo", () => {
  assert.equal(pushState(base), "off");
});

test("pushState: já ativado exige permissão concedida E inscrição", () => {
  assert.equal(pushState({ ...base, permission: "granted", subscribed: true }), "on");
  assert.equal(pushState({ ...base, permission: "granted", subscribed: false }), "off");
});

test("pushState: navegador sem suporte e servidor sem chaves", () => {
  assert.equal(pushState({ ...base, supported: false, permission: "unsupported" }), "unsupported");
  assert.equal(pushState({ ...base, serverEnabled: false }), "server_off");
});

test("pushState: permissão negada", () => {
  assert.equal(pushState({ ...base, permission: "denied" }), "denied");
});

test("pushState: iPhone só funciona com o app instalado (mesmo sem suporte aparente)", () => {
  assert.equal(pushState({ ...base, isIos: true, standalone: false, supported: false, permission: "unsupported" }), "needs_install");
  assert.equal(pushState({ ...base, isIos: true, standalone: true }), "off");
});
