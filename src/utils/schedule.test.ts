import { describe, expect, it } from "vite-plus/test";
import {
  formatScheduleLabel,
  isValidScheduleInstant,
  scheduledAtFromLabels,
  SCHEDULE_LABEL_PREFIX,
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
