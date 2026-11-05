import test from "node:test";
import assert from "node:assert/strict";
import { isReviewDecision, needsReviewer } from "../lib/postReview.ts";

test("needsReviewer: só aprovar ou pedir ajustes é decisão da redatora", () => {
  assert.equal(needsReviewer("andamento", "checagem_aprovacao"), false);
  assert.equal(needsReviewer("checagem_aprovacao", "finalizados"), true);
  assert.equal(needsReviewer("andamento", "finalizados"), true); // pular a revisão também é barrado
  assert.equal(needsReviewer("checagem_aprovacao", "modificacoes"), true);
  assert.equal(needsReviewer("modificacoes", "andamento"), false);
});

test("needsReviewer: post já aprovado vai pra publicados sem revisão nova", () => {
  assert.equal(needsReviewer("finalizados", "publicados"), false);
  assert.equal(needsReviewer("checagem_aprovacao", "publicados"), true);
});

test("isReviewDecision: só quem sai da checagem", () => {
  assert.equal(isReviewDecision("checagem_aprovacao", "modificacoes"), true);
  assert.equal(isReviewDecision("checagem_aprovacao", "finalizados"), true);
  assert.equal(isReviewDecision("checagem_aprovacao", "andamento"), false);
  assert.equal(isReviewDecision("andamento", "finalizados"), false);
});
