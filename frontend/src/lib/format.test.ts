import { describe, expect, it } from "vitest";

import {
  formatChange,
  formatCount,
  formatCurrency,
  formatDurationSeconds,
  formatKPIValue,
  formatMultiplier,
  formatPercent,
  toNumber,
} from "./format";

describe("toNumber", () => {
  it("parses string decimals", () => {
    expect(toNumber("12.34")).toBe(12.34);
  });

  it("returns null for null/undefined/empty", () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber("")).toBeNull();
  });

  it("returns null for invalid strings", () => {
    expect(toNumber("not a number")).toBeNull();
  });

  it("passes through numbers", () => {
    expect(toNumber(42)).toBe(42);
  });
});

describe("formatCount", () => {
  it("formats with TR locale separator", () => {
    expect(formatCount(1234567)).toBe("1.234.567");
  });

  it("returns dash for null", () => {
    expect(formatCount(null)).toBe("—");
  });
});

describe("formatCurrency", () => {
  it("uses TRY symbol", () => {
    const out = formatCurrency(1234);
    expect(out).toMatch(/1\.234/);
    expect(out).toMatch(/₺/);
  });

  it("compact for large values", () => {
    const out = formatCurrency(1500000, { compact: true });
    expect(out).toMatch(/Mn|M/);
  });

  it("returns dash for null", () => {
    expect(formatCurrency(null)).toBe("—");
  });
});

describe("formatPercent", () => {
  it("appends % suffix", () => {
    expect(formatPercent(45.6)).toBe("45,60%");
  });

  it("respects fractionDigits", () => {
    expect(formatPercent(45.6789, 4)).toBe("45,6789%");
  });
});

describe("formatMultiplier", () => {
  it("appends x suffix with 2 decimals (TR locale: virgül)", () => {
    expect(formatMultiplier(4.5)).toBe("4,50x");
    expect(formatMultiplier("12.345")).toBe("12,35x");
  });
});

describe("formatDurationSeconds", () => {
  it("seconds only under 60", () => {
    expect(formatDurationSeconds(45)).toBe("45sn");
  });

  it("minutes + seconds for >= 60", () => {
    expect(formatDurationSeconds(125)).toBe("2dk 5sn");
  });
});

describe("formatChange", () => {
  it("adds + sign for positive", () => {
    // toFixed(1) banker's rounding değil — JS Number.toFixed yarım aşağı
    expect(formatChange("12.45")).toBe("+12.4%");
  });

  it("keeps minus for negative", () => {
    expect(formatChange("-7.8")).toBe("-7.8%");
  });

  it("returns dash for null", () => {
    expect(formatChange(null)).toBe("—");
  });
});

describe("formatKPIValue dispatcher", () => {
  it("dispatches by unit", () => {
    expect(formatKPIValue(1500000, "currency")).toMatch(/₺/);
    expect(formatKPIValue(45.6, "percent")).toMatch(/%/);
    expect(formatKPIValue(4.5, "multiplier")).toBe("4,50x");
    expect(formatKPIValue(125, "duration_seconds")).toBe("2dk 5sn");
    expect(formatKPIValue(1234, "count")).toMatch(/Bn|1,2/);
  });
});
