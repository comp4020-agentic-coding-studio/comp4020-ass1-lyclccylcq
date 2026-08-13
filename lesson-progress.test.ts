import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isChapterComplete, markComplete } from "./lesson-progress";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lesson-progress, with a real window", () => {
  it("round-trips completion state through localStorage", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    vi.stubGlobal("window", dom.window);

    expect(isChapterComplete("connected-groups")).toBe(false);
    markComplete("connected-groups");
    expect(isChapterComplete("connected-groups")).toBe(true);
    expect(isChapterComplete("illegal-moves")).toBe(false);
  });

  it("tracks multiple chapters independently", () => {
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://example.test/" });
    vi.stubGlobal("window", dom.window);

    markComplete("liberties-and-capture");
    markComplete("illegal-moves");
    expect(isChapterComplete("liberties-and-capture")).toBe(true);
    expect(isChapterComplete("illegal-moves")).toBe(true);
    expect(isChapterComplete("connected-groups")).toBe(false);
  });
});

describe("lesson-progress, with no window (the Node test environment Lessons 1-4 run under)", () => {
  it("markComplete does not throw when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(() => markComplete("connected-groups")).not.toThrow();
  });

  it("isChapterComplete returns false when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(isChapterComplete("connected-groups")).toBe(false);
  });
});
