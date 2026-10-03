import assert from "node:assert/strict";
import test from "node:test";
import { galleryPagination } from "../src/lib/gallery-pagination";

test("new searches reset an expanded gallery before rendering results", () => {
  const expanded = galleryPagination({ searchQuery: "", visibleCount: 30 }, { type: "more", total: 120 });
  assert.equal(expanded.visibleCount, 60);
  assert.deepEqual(galleryPagination(expanded, { type: "search", query: "portrait" }), { searchQuery: "portrait", visibleCount: 30 });
});
test("repeated search values preserve scrolling progress", () => {
  assert.deepEqual(galleryPagination({ searchQuery: "portrait", visibleCount: 90 }, { type: "search", query: "portrait" }), { searchQuery: "portrait", visibleCount: 90 });
});
test("loading more cannot reveal beyond the filtered result count", () => {
  assert.equal(galleryPagination({ searchQuery: "portrait", visibleCount: 30 }, { type: "more", total: 41 }).visibleCount, 41);
});
