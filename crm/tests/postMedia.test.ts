import assert from "node:assert/strict";
import { test } from "node:test";
import { removeAt, switchPostType, withSlides, type PostMedia } from "../lib/postMedia.ts";

const feed = (img: string | null): PostMedia => ({ post_type: "feed", final_image: img, final_images: [] });
const carousel = (urls: string[]): PostMedia => ({ post_type: "carousel", ...withSlides(urls) });

test("feed -> carrossel: a arte única vira o 1º slide", () => {
  assert.deepEqual(switchPostType(feed("a"), "carousel"), carousel(["a"]));
});

test("carrossel -> feed: a capa vira a arte única e os slides são limpos", () => {
  assert.deepEqual(switchPostType(carousel(["a", "b", "c"]), "feed"), feed("a"));
});

test("feed -> carrossel -> feed -> carrossel recupera os slides se a capa não mudou", () => {
  const stash = ["a", "b", "c"];
  assert.deepEqual(switchPostType(feed("a"), "carousel", stash), carousel(stash));
});

test("a arte nova do feed não é sobrescrita por slides antigos", () => {
  assert.deepEqual(switchPostType(feed("nova"), "carousel", ["a", "b", "c"]), carousel(["nova"]));
});

test("mesmo tipo não altera nada", () => {
  const state = feed("a");
  assert.equal(switchPostType(state, "feed"), state);
});

test("withSlides mantém a ordem e a capa é o 1º", () => {
  assert.deepEqual(withSlides(["b", "a"]), { final_images: ["b", "a"], final_image: "b" });
  assert.deepEqual(withSlides([]), { final_images: [], final_image: null });
});

test("removeAt remove só a posição pedida, mesmo com URL repetida", () => {
  assert.deepEqual(removeAt(["a", "a", "b"], 0), ["a", "b"]);
});
