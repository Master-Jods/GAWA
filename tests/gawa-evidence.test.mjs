import test from "node:test";
import assert from "node:assert/strict";
import { buildPassportMarks, skillOverlap, safeWorkUrl } from "../src/components/gawa/evidence.ts";
const now = Date.parse("2026-11-20T00:00:00Z");
test("Fit Lens preserves zero overlap and deduplicates equivalent requirements", () => {
  assert.deepEqual(skillOverlap([" React ", "react", "SQL"], ["REACT"]), {
    matched: ["React"],
    missing: ["SQL"],
  });
  assert.deepEqual(skillOverlap(["SQL"], ["Figma"]), { matched: [], missing: ["SQL"] });
});
test("listed skills are not represented as verified credentials", () => {
  const [mark] = buildPassportMarks(
    [{ name: "React", proficiency: "advanced" }],
    [],
    [],
    [],
    [],
    now,
  );
  assert.equal(mark.state, "declared");
  assert.equal(mark.score, undefined);
});
test("expired, rejected and pending evidence cannot produce verified stamps", () => {
  for (const record of [
    { status: "verified", expires_at: "2026-11-19" },
    { status: "verified", expires_at: "invalid-date" },
    { status: "expired" },
    { status: "rejected" },
    { status: "submitted" },
  ]) {
    const [mark] = buildPassportMarks(
      [],
      [{ id: "v1", skill_name: "React", ...record }],
      [],
      [],
      [],
      now,
    );
    assert.notEqual(mark.state, "verified");
  }
});
test("latest skill record takes precedence over an older result and name casing", () => {
  const marks = buildPassportMarks(
    [{ name: "React" }],
    [
      { id: "old", skill_name: "REACT", status: "verified", score: 95, submitted_at: "2026-11-01" },
      { id: "new", skill_name: "react", status: "in_review", submitted_at: "2026-11-19" },
    ],
    [],
    [],
    [],
    now,
  );
  assert.equal(marks.length, 1);
  assert.equal(marks[0].state, "pending");
});
test("work and reviews retain their provenance instead of granting skill badges", () => {
  const marks = buildPassportMarks(
    [],
    [],
    [{ id: "w1", title: "A work sample" }],
    [{ id: "c1", title: "A completed contract" }],
    [{ id: "r1", rating: 5 }],
    now,
  );
  assert.deepEqual(
    marks.map((m) => m.state),
    ["work", "completed", "feedback"],
  );
  assert(!marks.some((m) => m.category === "skills"));
});
test("work sample links reject executable and malformed URLs", () => {
  for (const value of ["javascript:alert(1)", "data:text/html,test", "/relative", "not-a-url"])
    assert.equal(safeWorkUrl(value), undefined);
  assert.equal(safeWorkUrl("https://example.com"), "https://example.com/");
});
