import { describe, expect, it } from "vitest";
import { pickModelDay } from "../../src/lib/risk/model-day";

const files = { today: "2026-11-14", tomorrow: "2026-11-15" };

describe("pickModelDay", () => {
  it("shows the file's tomorrow as today once the calendar has moved on", () => {
    expect(pickModelDay(files, "2026-11-15", 0)).toEqual({ date: "2026-11-15", latest: false });
  });

  it("matches both days on the day the files were made", () => {
    expect(pickModelDay(files, "2026-11-14", 0)).toEqual({ date: "2026-11-14", latest: false });
    expect(pickModelDay(files, "2026-11-15", 1)).toEqual({ date: "2026-11-15", latest: false });
  });

  it("has no model score for a later day without a file", () => {
    expect(pickModelDay(files, "2026-11-16", 1)).toBeNull();
  });

  it("falls back to the latest earlier day for today, marked as latest", () => {
    expect(pickModelDay(files, "2026-11-17", 0)).toEqual({ date: "2026-11-15", latest: true });
  });

  it("never shows a forecast for a day after the viewed one", () => {
    expect(pickModelDay({ today: "2026-11-20", tomorrow: "2026-11-21" }, "2026-11-19", 0)).toBeNull();
  });
});
