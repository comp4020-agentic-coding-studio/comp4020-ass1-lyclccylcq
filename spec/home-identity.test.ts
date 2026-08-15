// The Home page carries two identities on purpose, and they must stay
// separate: the book is a Chinese object with a Chinese title, and the site
// is an English project named beside it. These run against the BUILT site,
// same as the other spec files — run `pnpm build` first (`pnpm check` does).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

const doc = new JSDOM(readFileSync(resolve("dist", "index.html"), "utf8")).window.document;

describe("the book keeps its own Chinese identity", () => {
  it("still reads 围棋入门 on the title slip", () => {
    expect(doc.querySelector(".cover-book-label-text")?.textContent?.trim()).toBe("围棋入门");
  });

  it("never puts the English name on the book itself", () => {
    const book = doc.querySelector(".cover-book");
    expect(book, "expected the closed book to still be on the cover").toBeTruthy();
    expect(book?.textContent ?? "").not.toMatch(/learn\s*go/i);
  });

  it("keeps the cover a single working link into the book", () => {
    const link = doc.querySelector<HTMLAnchorElement>("a.cover-enter");
    expect(link?.getAttribute("href")).toBe("./contents.html");
    expect(link?.querySelector(".cover-book")).toBeTruthy();
  });
});

describe("the English wordmark belongs to the room, not the book", () => {
  const wordmark = doc.querySelector(".cover-wordmark");

  it("names the project in English", () => {
    expect(wordmark?.textContent?.replace(/\s+/g, " ").trim()).toBe("Learn Go");
  });

  it("sits outside the book and outside the cover link", () => {
    expect(wordmark?.closest(".cover-book")).toBeNull();
    expect(wordmark?.closest("a")).toBeNull();
  });

  it("is branding rather than a heading or a control", () => {
    expect(wordmark?.tagName).toBe("P");
    expect(wordmark?.querySelector("a, button")).toBeNull();
    // The page's accessible name already comes from the h1, so announcing
    // this too would just say "Learn Go" twice.
    expect(wordmark?.getAttribute("aria-hidden")).toBe("true");
  });

  it("doesn't add a second top-level heading", () => {
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
  });
});

describe("the cinnabar seal on the cover", () => {
  const seal = doc.querySelector(".cover-seal");

  it("stamps 弈 on the title slip", () => {
    expect(seal, "expected a seal on the cover").toBeTruthy();
    expect(seal?.querySelector(".cover-seal-glyph")?.textContent?.trim()).toBe("弈");
  });

  it("is printed inside the title label, not on the cloth beside the kifu", () => {
    // It belongs to the label so it tracks the title at every viewport —
    // an absolute offset over the artwork would drift.
    expect(seal?.closest(".cover-book-label")).toBeTruthy();
    expect(doc.querySelector(".cover-book-art .cover-seal")).toBeNull();
  });

  it("follows the title within the label, so it reads below 门", () => {
    const label = doc.querySelector(".cover-book-label");
    // getAttribute, not .className: on an SVG element that property is an
    // SVGAnimatedString rather than a string.
    const children = [...(label?.children ?? [])].map((child) => child.getAttribute("class"));
    expect(children).toEqual(["cover-book-label-text", "cover-seal"]);
  });

  it("exists exactly once on the whole cover", () => {
    expect(doc.querySelectorAll(".cover-seal")).toHaveLength(1);
    expect(doc.querySelectorAll(".cover-seal-glyph")).toHaveLength(1);
  });

  it("is drawn as a stamp, not pasted on as an image", () => {
    expect(seal?.querySelector(".cover-seal-border")?.tagName).toBe("path");
    expect(doc.querySelector("#seal-ink"), "expected the stamped-ink filter").toBeTruthy();
    expect(doc.querySelectorAll(".cover-seal img")).toHaveLength(0);
  });

  it("stays decorative: inside the aria-hidden artwork, with no tab stop", () => {
    expect(seal?.closest("[aria-hidden='true']")).toBeTruthy();
    expect(seal?.querySelector("[tabindex], a, button")).toBeNull();
  });

  it("leaves the kifu illustration in place beside it", () => {
    expect(doc.querySelectorAll(".cover-kifu-stone-black, .cover-kifu-stone-white").length).toBeGreaterThan(0);
  });
});
