import { describe, expect, it } from "vite-plus/test";
import {
  formatScheduleLabel,
  isValidScheduleInstant,
  scheduleIsPending,
  scheduledAtFromLabels,
  SCHEDULE_LABEL_PREFIX,
  withFrontmatterStatus,
} from "./cms-drafts.ts";

// Schedule labels carry unattended publishes: `cms-schedule:<UTC ISO>` on the
// open revision PR. These pin the format/parse contract the writer endpoint,
// the tick runner, and the dashboard badge all share.

describe("formatScheduleLabel", () => {
  it("prefixes the canonical ISO instant", () => {
    expect(formatScheduleLabel("2026-10-20T02:00:00.000Z")).toBe(
      `${SCHEDULE_LABEL_PREFIX}2026-10-20T02:00:00.000Z`,
    );
  });
});

describe("scheduledAtFromLabels", () => {
  it("returns null without labels", () => {
    expect(scheduledAtFromLabels(undefined)).toBeNull();
    expect(scheduledAtFromLabels([])).toBeNull();
  });

  it("extracts and canonicalizes the scheduled instant", () => {
    expect(
      scheduledAtFromLabels([{ name: "cms-schedule:2026-10-20T02:00:00Z" }, { name: "reviewed" }]),
    ).toBe("2026-10-20T02:00:00.000Z");
  });

  it("ignores malformed schedule labels instead of blocking", () => {
    expect(scheduledAtFromLabels([{ name: "cms-schedule:not-a-date" }])).toBeNull();
  });

  it("ignores non-schedule labels", () => {
    expect(scheduledAtFromLabels([{ name: "cms-schedule" }, { name: "bug" }])).toBeNull();
  });
});

describe("isValidScheduleInstant", () => {
  it("accepts ISO instants (past allowed: publish ASAP)", () => {
    expect(isValidScheduleInstant("2026-10-20T02:00:00Z")).toBe(true);
    expect(isValidScheduleInstant("2000-01-01T00:00:00Z")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidScheduleInstant("besok pagi")).toBe(false);
    expect(isValidScheduleInstant(null)).toBe(false);
    expect(isValidScheduleInstant(123)).toBe(false);
  });
});

describe("scheduleIsPending", () => {
  const now = Date.parse("2026-11-03T06:00:00Z");

  it("is pending while the promised instant is in the future", () => {
    expect(scheduleIsPending("2026-11-03T06:00:01Z", now)).toBe(true);
  });

  it("is not pending at or after the promised instant", () => {
    expect(scheduleIsPending("2026-11-03T06:00:00Z", now)).toBe(false);
    expect(scheduleIsPending("2026-11-03T05:59:00Z", now)).toBe(false);
  });

  it("is never pending without a valid instant", () => {
    expect(scheduleIsPending(null, now)).toBe(false);
    expect(scheduleIsPending(undefined, now)).toBe(false);
    expect(scheduleIsPending("besok pagi", now)).toBe(false);
  });
});

describe("withFrontmatterStatus", () => {
  const article = [
    "---",
    "id: 4b1f0b3e-2b0b-4c33-9a7b-26f2f4a2f9a1",
    "slug: tes-7",
    'title: "Tes 7"',
    "status: published",
    "draft: false",
    "---",
    "",
    "Isi artikel.",
    "",
  ].join("\n");

  it("rewrites the status field and leaves every other line alone", () => {
    const next = withFrontmatterStatus(article, "draft");
    expect(next).toContain("status: draft");
    expect(next).not.toContain("status: published");
    expect(next).toContain('title: "Tes 7"');
    expect(next.endsWith("Isi artikel.\n")).toBe(true);
  });

  it("adds the field when the file does not carry one", () => {
    const legacy = ["---", "slug: tes-7", "draft: true", "---", "", "Isi."].join("\n");
    expect(withFrontmatterStatus(legacy, "published")).toContain("status: published");
    // The legacy boolean is left untouched: blogStatus() prefers `status`, and
    // rewriting authored fields is not this helper's job.
    expect(withFrontmatterStatus(legacy, "published")).toContain("draft: true");
  });

  it("refuses a file without frontmatter instead of guessing", () => {
    expect(() => withFrontmatterStatus("Isi tanpa frontmatter.", "draft")).toThrow();
  });
});
