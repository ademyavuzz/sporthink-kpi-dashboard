import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { type ColumnDef, useColumnManager } from "./useColumnManager";

const COLUMNS: ColumnDef[] = [
  { id: "rank", labelKey: "col_rank", required: true },
  { id: "sku", labelKey: "col_sku" },
  { id: "name", labelKey: "col_name" },
  { id: "revenue", labelKey: "col_revenue" },
];

const STORAGE_KEY = "table-columns:test-table";

/** jsdom localStorage davranisi ortama gore degisebildigi icin deterministik mock. */
function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: createLocalStorageMock(),
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  window.localStorage.clear();
});

describe("useColumnManager", () => {
  it("starts with default order and all columns visible", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual([
      "rank",
      "sku",
      "name",
      "revenue",
    ]);
    expect(result.current.isCustomized).toBe(false);
  });

  it("hides and shows an optional column", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    act(() => result.current.toggleVisibility("sku"));
    expect(result.current.isVisible("sku")).toBe(false);
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual([
      "rank",
      "name",
      "revenue",
    ]);
    expect(result.current.isCustomized).toBe(true);

    act(() => result.current.toggleVisibility("sku"));
    expect(result.current.isVisible("sku")).toBe(true);
  });

  it("never hides a required column", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    act(() => result.current.toggleVisibility("rank"));
    expect(result.current.isVisible("rank")).toBe(true);
    expect(result.current.isCustomized).toBe(false);
  });

  it("reorders an optional column onto another", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    // revenue -> sku konumuna tasi
    act(() => result.current.reorder("revenue", "sku"));
    expect(result.current.orderedColumns.map((c) => c.id)).toEqual([
      "rank",
      "revenue",
      "sku",
      "name",
    ]);
  });

  it("ignores reorder that targets a required column", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    act(() => result.current.reorder("revenue", "rank"));
    expect(result.current.orderedColumns.map((c) => c.id)).toEqual([
      "rank",
      "sku",
      "name",
      "revenue",
    ]);
  });

  it("persists preferences to localStorage", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    act(() => {
      result.current.toggleVisibility("name");
      result.current.reorder("revenue", "sku");
    });
    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored as string) as {
      order: string[];
      hidden: string[];
    };
    expect(parsed.hidden).toContain("name");
    expect(parsed.order).toEqual(["rank", "revenue", "sku", "name"]);
  });

  it("restores persisted preferences on mount", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ order: ["rank", "revenue", "name", "sku"], hidden: ["sku"] }),
    );
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    expect(result.current.orderedColumns.map((c) => c.id)).toEqual([
      "rank",
      "revenue",
      "name",
      "sku",
    ]);
    expect(result.current.isVisible("sku")).toBe(false);
    expect(result.current.isCustomized).toBe(true);
  });

  it("appends newly added columns not present in stored order", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ order: ["rank", "sku"], hidden: [] }),
    );
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    // name ve revenue saklanan sirada yok -> orijinal sirayla sona eklenir
    expect(result.current.orderedColumns.map((c) => c.id)).toEqual([
      "rank",
      "sku",
      "name",
      "revenue",
    ]);
  });

  it("reset returns to default and clears storage", () => {
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    act(() => {
      result.current.toggleVisibility("sku");
      result.current.reorder("revenue", "name");
    });
    expect(result.current.isCustomized).toBe(true);

    act(() => result.current.reset());
    expect(result.current.isCustomized).toBe(false);
    expect(result.current.visibleColumns.map((c) => c.id)).toEqual([
      "rank",
      "sku",
      "name",
      "revenue",
    ]);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("falls back to default when stored data is corrupt", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ not valid json");
    const { result } = renderHook(() => useColumnManager("test-table", COLUMNS));
    expect(result.current.orderedColumns.map((c) => c.id)).toEqual([
      "rank",
      "sku",
      "name",
      "revenue",
    ]);
  });
});
