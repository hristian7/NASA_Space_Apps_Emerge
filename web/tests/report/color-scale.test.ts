import { describe, expect, it } from "vitest";
import {
  ANOMALY_BREAKS,
  anomalyStep,
  anomalyToken,
  cellKind,
  quantileSorted,
  rampStep,
  rampThresholds,
  rampToken,
} from "../../src/components/report/lib/color-scale";

describe("cellKind", () => {
  it("keeps no data, zero and a value apart (M19)", () => {
    expect(cellKind(null)).toBe("nodata");
    expect(cellKind(0)).toBe("zero");
    expect(cellKind(1)).toBe("value");
    expect(cellKind(0.4)).toBe("value");
  });

  it("treats a non-finite number as no data", () => {
    expect(cellKind(Number.NaN)).toBe("nodata");
    expect(cellKind(Number.POSITIVE_INFINITY)).toBe("nodata");
  });
});

describe("rampToken", () => {
  it("gives no token for no data, so the caller draws the pattern", () => {
    expect(rampToken("nodata", 0)).toBeNull();
  });

  it("gives the lightest tone for zero and never a ramp step", () => {
    expect(rampToken("zero", 3)).toBe("var(--empty)");
  });

  it("gives one of the four ramp steps for a value", () => {
    expect(rampToken("value", 0)).toBe("var(--ramp-0)");
    expect(rampToken("value", 3)).toBe("var(--ramp-3)");
  });

  it("clamps a step outside the ramp", () => {
    expect(rampToken("value", 9)).toBe("var(--ramp-3)");
    expect(rampToken("value", -2)).toBe("var(--ramp-0)");
  });
});

describe("quantileSorted", () => {
  it("interpolates between the two neighbours", () => {
    expect(quantileSorted([0, 10], 0.5)).toBe(5);
    expect(quantileSorted([0, 1, 2, 3, 4], 0.5)).toBe(2);
  });

  it("answers for a single value and for none", () => {
    expect(quantileSorted([7], 0.9)).toBe(7);
    expect(quantileSorted([], 0.5)).toBe(0);
  });
});

describe("rampThresholds", () => {
  it("splits only the positive values, leaving zero and null out", () => {
    const values = [null, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const thresholds = rampThresholds(values);
    expect(thresholds).toHaveLength(3);
    expect(thresholds[0]).toBeGreaterThan(0);
    expect(thresholds[0]).toBeLessThan(thresholds[1]);
    expect(thresholds[1]).toBeLessThan(thresholds[2]);
  });

  it("stays strictly rising when most values are identical", () => {
    const thresholds = rampThresholds([5, 5, 5, 5, 5, 5, 5, 5]);
    expect(thresholds[0]).toBeLessThan(thresholds[1]);
    expect(thresholds[1]).toBeLessThan(thresholds[2]);
  });

  it("falls back to a usable scale when nothing is positive", () => {
    expect(rampThresholds([null, 0, 0])).toEqual([1, 2, 3]);
    expect(rampThresholds([])).toEqual([1, 2, 3]);
  });
});

describe("rampStep", () => {
  const thresholds = [10, 100, 1000];

  it("puts a value equal to a break in the step above it", () => {
    expect(rampStep(9, thresholds)).toBe(0);
    expect(rampStep(10, thresholds)).toBe(1);
    expect(rampStep(99, thresholds)).toBe(1);
    expect(rampStep(100, thresholds)).toBe(2);
    expect(rampStep(1000, thresholds)).toBe(3);
  });

  it("never returns a step outside the ramp", () => {
    expect(rampStep(1, thresholds)).toBe(0);
    expect(rampStep(5_000_000, thresholds)).toBe(3);
  });

  it("gives every ramp step over a spread of values", () => {
    const seen = new Set(
      [1, 50, 500, 5000].map((value) => rampStep(value, thresholds)),
    );
    expect(seen).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe("anomaly scale", () => {
  it("is symmetric about the usual level", () => {
    expect(ANOMALY_BREAKS).toEqual([0.5, 0.8, 1, 1.25, 2]);
    expect(anomalyStep(0.4)).toBe(0);
    expect(anomalyStep(0.5)).toBe(1);
    expect(anomalyStep(0.9)).toBe(2);
    expect(anomalyStep(1)).toBe(3);
    expect(anomalyStep(1.3)).toBe(4);
    expect(anomalyStep(2)).toBe(5);
    expect(anomalyStep(12)).toBe(5);
  });

  it("gives no token when there is nothing to compare with", () => {
    expect(anomalyToken(null)).toBeNull();
    expect(anomalyToken(Number.NaN)).toBeNull();
    expect(anomalyToken(1)).toBe("var(--anom-3)");
  });
});
