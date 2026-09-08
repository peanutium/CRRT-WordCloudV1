import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_CLOUD_WORDS,
  buildWordLayout,
  makeWordKey,
  normalizeAnswer,
  summarizeWordRecords,
  validateAnswer,
} from "../dist/poll-utils.js";

test("normalizes spacing, width, and capitalization", () => {
  assert.equal(normalizeAnswer("  ＰＲＥＣＩＳＥ  "), "precise");
  assert.deepEqual(validateAnswer("Efficient"), {
    valid: true,
    normalized: "efficient",
    label: "Efficient",
  });
});

test("accepts Unicode words and common one-word punctuation", () => {
  assert.equal(validateAnswer("life-saving").valid, true);
  assert.equal(validateAnswer("can't").valid, true);
  assert.equal(validateAnswer("精準").valid, true);
});

test("rejects empty, multi-word, and unsupported answers", () => {
  assert.equal(validateAnswer(" ").valid, false);
  assert.equal(validateAnswer("life saving").valid, false);
  assert.equal(validateAnswer("wow!").valid, false);
});

test("creates Firebase-safe stable keys", () => {
  assert.equal(makeWordKey("precise"), makeWordKey("precise"));
  assert.doesNotMatch(makeWordKey("精準"), /[.#$\[\]\/]/);
});

test("summarizes and ranks valid cumulative records", () => {
  const summary = summarizeWordRecords({
    a: { label: "Precise", normalized: "precise", count: 3 },
    b: { label: "Essential", normalized: "essential", count: 5 },
    broken: { label: "Broken", normalized: "broken", count: -1 },
  });
  assert.equal(summary.total, 8);
  assert.equal(summary.unique, 2);
  assert.deepEqual(summary.words.map((word) => word.label), ["Essential", "Precise"]);
});

test("lays out a bounded, non-overlapping cloud", () => {
  const words = Array.from({ length: MAX_CLOUD_WORDS + 5 }, (_, index) => ({
    label: `Word${index}`,
    count: MAX_CLOUD_WORDS + 5 - index,
  }));
  const layout = buildWordLayout(words, 900, 500);
  assert.ok(layout.length > 20);
  assert.ok(layout.length <= MAX_CLOUD_WORDS);
  for (const item of layout) {
    assert.ok(item.left >= 0);
    assert.ok(item.right <= 900);
    assert.ok(item.top >= 0);
    assert.ok(item.bottom <= 500);
  }
});
