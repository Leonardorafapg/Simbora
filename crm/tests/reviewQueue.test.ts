import assert from "node:assert/strict";
import { test } from "node:test";
import {
  briefingAttachmentCount,
  hasFinalArt,
  matchesSearch,
  matchesTab,
  sortByWaiting,
  tabCounts,
} from "../lib/reviewQueue.ts";
import type { CalendarEntry } from "../types/calendar.ts";

const entry = (over: Partial<CalendarEntry> = {}): CalendarEntry =>
  ({
    id: 1,
    client_id: 1,
    scheduled_date: "2026-11-20",
    title: "Chopp e petisco",
    theme: "Pastéis quentinhos",
    post_type: "feed",
    final_image: null,
    final_image_story: null,
    final_images: [],
    final_links: [],
    reference_image: null,
    reference_link: null,
    reference_links: [],
    material_files: [],
    material_links: [],
    delivered_at: null,
    ...over,
  }) as CalendarEntry;

test("hasFinalArt: arte do feed, slides do carrossel, stories e link de vídeo contam; vazio não", () => {
  assert.equal(hasFinalArt(entry()), false);
  assert.equal(hasFinalArt(entry({ final_image: "https://x/a.png" })), true);
  assert.equal(hasFinalArt(entry({ post_type: "carousel", final_images: ["https://x/1.png"] })), true);
  assert.equal(hasFinalArt(entry({ final_image_story: "https://x/s.png" })), true);
  assert.equal(hasFinalArt(entry({ post_type: "video", final_links: ["https://x/v"] })), true);
});

test("abas e contagens: todos = com arte + aguardando mídia", () => {
  const list = [entry({ id: 1, final_image: "https://x/a.png" }), entry({ id: 2 }), entry({ id: 3 })];
  assert.deepEqual(tabCounts(list), { todos: 3, com_arte: 1, aguardando: 2 });
  assert.deepEqual(list.filter((e) => matchesTab(e, "com_arte")).map((e) => e.id), [1]);
  assert.deepEqual(list.filter((e) => matchesTab(e, "aguardando")).map((e) => e.id), [2, 3]);
  assert.equal(list.filter((e) => matchesTab(e, "todos")).length, 3);
});

test("briefingAttachmentCount: referência, material e links; ignora a arte final", () => {
  assert.equal(briefingAttachmentCount(entry({ final_image: "https://x/a.png" })), 0);
  assert.equal(
    briefingAttachmentCount(
      entry({ reference_image: "r.png", material_files: ["a", "b"], reference_links: ["l1"], material_links: ["l2"] }),
    ),
    5,
  );
  // Postagem antiga guardava um link único em reference_link.
  assert.equal(briefingAttachmentCount(entry({ reference_link: "https://old" })), 1);
  assert.equal(briefingAttachmentCount(entry({ reference_link: "https://old", reference_links: ["https://new"] })), 1);
});

test("matchesSearch: cliente, título e designer, sem acento nem maiúscula", () => {
  const e = entry();
  const names = { client: "B&B Pátio Norte", designer: "Brian Araújo" };
  assert.equal(matchesSearch(e, "", names), true);
  assert.equal(matchesSearch(e, "patio", names), true);
  assert.equal(matchesSearch(e, "CHOPP", names), true);
  assert.equal(matchesSearch(e, "araujo", names), true);
  assert.equal(matchesSearch(e, "inexistente", names), false);
});

test("sortByWaiting: quem entregou primeiro vem primeiro; sem entrega, pela data do post", () => {
  const a = entry({ id: 1, delivered_at: "2026-11-05T12:00:00", scheduled_date: "2026-11-30" });
  const b = entry({ id: 2, delivered_at: "2026-11-04T09:00:00", scheduled_date: "2026-11-30" });
  const c = entry({ id: 3, delivered_at: null, scheduled_date: "2026-11-01" });
  assert.deepEqual(sortByWaiting([a, c, b]).map((e) => e.id), [2, 1, 3]);
});
