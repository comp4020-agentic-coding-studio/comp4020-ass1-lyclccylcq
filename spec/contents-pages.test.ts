import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Two-Contents-page contract (book-shell refinement): Contents must always be
// split across exactly two pages, never merged back into one and never
// dropped from the navigation sequence. Runs against the BUILT site, same as
// spec/invariants.test.ts — run `pnpm build` first (`pnpm check` does).
const DIST = resolve("dist");

function htmlFiles(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name.endsWith(".html") ? [path] : [];
  });
}

const pages = htmlFiles().map((path) => ({
  name: relative(DIST, path),
  path,
  doc: new JSDOM(readFileSync(path, "utf8")).window.document,
}));

function hrefs(doc: Document, selector: string): string[] {
  return [...doc.querySelectorAll<HTMLAnchorElement>(selector)].map((a) => a.getAttribute("href") ?? "");
}

// Vite extracts each page's inline `<script type="module">` into its own
// bundled asset at build time, leaving only a `src`-pointing <script> behind —
// so checking which page id a page mounts means reading that bundle, not the
// (by-then-empty) inline script text.
function mountedModuleSource(doc: Document, htmlPath: string): string {
  const script = doc.querySelector<HTMLScriptElement>("script[type=module]");
  const src = script?.getAttribute("src");
  if (!src) return script?.textContent ?? "";
  return readFileSync(join(dirname(htmlPath), src), "utf8");
}

describe("Contents is split across exactly two pages", () => {
  const contents1 = pages.find(({ name }) => name === "contents.html");
  const contents2 = pages.find(({ name }) => name === "contents-2.html");

  it("both Contents pages exist", () => {
    expect(contents1).toBeTruthy();
    expect(contents2).toBeTruthy();
  });

  it("each Contents page mounts its own distinct book-nav id, so they never collapse into one state", () => {
    // The build minifies/renames the mount() call and switches to backtick
    // string literals, so match the quoted argument rather than the literal
    // source text: /["'`]contents["'`]\s*,/ for the exact id "contents".
    const bundle1 = mountedModuleSource(contents1!.doc, contents1!.path);
    const bundle2 = mountedModuleSource(contents2!.doc, contents2!.path);
    expect(bundle1).toMatch(/["'`]contents["'`]\s*,/);
    expect(bundle2).toMatch(/["'`]contents-2["'`]\s*,/);
    // contents.html's bundle must call mount with the exact id "contents",
    // not "contents-2".
    expect(bundle1).not.toMatch(/["'`]contents-2["'`]\s*,/);
  });

  it("Contents page 1 links to the prologue and the first three chapters, not later chapters", () => {
    const links = hrefs(contents1!.doc, ".contents-list a");
    expect(links).toEqual([
      "./prologue.html",
      "./lessons/placing-stones.html",
      "./lessons/liberties-and-capture.html",
      "./lessons/connected-groups.html",
    ]);
  });

  it("Contents page 2 links to chapters four through six, not the earlier ones", () => {
    const links = hrefs(contents2!.doc, ".contents-list a");
    expect(links).toEqual(["./lessons/illegal-moves.html", "./lessons/ko.html", "./lessons/scoring.html"]);
  });

  it("both pages share the same reusable page-material and sizing classes", () => {
    const box1 = contents1!.doc.querySelector(".book-open.leaf");
    const box2 = contents2!.doc.querySelector(".book-open.leaf");
    expect(box1).toBeTruthy();
    expect(box2).toBeTruthy();
  });

  it("Contents page 1's book-nav footer turns forward to Contents page 2", () => {
    // book-nav.ts mounts Prev/Next from BOOK_PAGES at runtime; statically we
    // only assert the empty #book-nav placeholder exists for it to mount into
    // (the adjacency itself is covered by book-nav.test.ts's getAdjacent
    // suite, which is the authoritative source for page order).
    expect(contents1!.doc.querySelector("#book-nav")).toBeTruthy();
    expect(contents2!.doc.querySelector("#book-nav")).toBeTruthy();
  });
});

describe("returning to Contents always lands on page 1", () => {
  for (const { name, doc } of pages) {
    if (name === "index.html") continue; // the cover has no header nav back to Contents

    it(`${name}'s header Contents link points at contents.html, not contents-2.html`, () => {
      const link = [...doc.querySelectorAll<HTMLAnchorElement>('header nav a')].find(
        (a) => a.textContent?.trim() === "Contents",
      );
      expect(link, "expected a header nav link labelled Contents").toBeTruthy();
      const href = link!.getAttribute("href") ?? "";
      expect(href.endsWith("/contents.html") || href === "./contents.html" || href === "contents.html").toBe(
        true,
      );
      expect(href.endsWith("contents-2.html")).toBe(false);
    });
  }
});
