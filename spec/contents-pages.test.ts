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

  it("Contents page 2 links to chapters four through seven plus free play, not the earlier ones", () => {
    const links = hrefs(contents2!.doc, ".contents-list a");
    expect(links).toEqual([
      "./lessons/illegal-moves.html",
      "./lessons/ko.html",
      "./lessons/endgame.html",
      "./lessons/scoring.html",
      "./free-play.html",
    ]);
  });

  it("both pages share the same reusable page-material and sizing classes", () => {
    const box1 = contents1!.doc.querySelector(".book-open.leaf");
    const box2 = contents2!.doc.querySelector(".book-open.leaf");
    expect(box1).toBeTruthy();
    expect(box2).toBeTruthy();
  });

  it("the cover's open-book link goes straight to Contents page 1, never page 2", () => {
    const index = pages.find(({ name }) => name === "index.html");
    const link = [...index!.doc.querySelectorAll<HTMLAnchorElement>("a")].find(
      (a) => a.getAttribute("href") === "./contents.html",
    );
    expect(link, "expected the cover to link straight to contents.html").toBeTruthy();
    expect([...index!.doc.querySelectorAll("a")].some((a) => a.getAttribute("href") === "./contents-2.html")).toBe(
      false,
    );
  });
});

// This exact bug — a real contents-2 that existed in code but was never
// reachable in a way a reader would notice — has survived multiple
// revisions, so it gets its own explicit regression coverage: a dedicated,
// paper-integrated corner control (not the generic .book-nav footer, whose
// label collapsed to a bare "Contents ›" because both pages share that
// title) genuinely flips the active page to contents-2, and back.
describe("Contents pages' bottom-corner page-turn controls", () => {
  const contents1 = pages.find(({ name }) => name === "contents.html");
  const contents2 = pages.find(({ name }) => name === "contents-2.html");

  it("Contents page 1 has a bottom-right corner control and no left one", () => {
    expect(contents1!.doc.querySelector(".book-open.leaf #page-turn-next")).toBeTruthy();
    expect(contents1!.doc.querySelector("#page-turn-prev")).toBeNull();
  });

  it("Contents page 2 has both a bottom-left and a bottom-right corner control", () => {
    expect(contents2!.doc.querySelector(".book-open.leaf #page-turn-prev")).toBeTruthy();
    expect(contents2!.doc.querySelector(".book-open.leaf #page-turn-next")).toBeTruthy();
  });

  it("Contents page 1's corner control is wired to turn forward from contents to contents-2", () => {
    // The bundler renames the imported function itself (e.g. mountPageTurn ->
    // `e`), so match on the call's quoted arguments rather than its name:
    // (id, querySelector(container), direction).
    const bundle = mountedModuleSource(contents1!.doc, contents1!.path);
    expect(bundle).toMatch(
      /\(\s*["'`]contents["'`]\s*,\s*document\.querySelector\(\s*["'`]#page-turn-next["'`]\s*\)\s*,\s*["'`]next["'`]/,
    );
  });

  it("Contents page 2's corner controls are wired to contents-2's own prev and next", () => {
    const bundle = mountedModuleSource(contents2!.doc, contents2!.path);
    expect(bundle).toMatch(
      /\(\s*["'`]contents-2["'`]\s*,\s*document\.querySelector\(\s*["'`]#page-turn-prev["'`]\s*\)\s*,\s*["'`]prev["'`]/,
    );
    expect(bundle).toMatch(
      /\(\s*["'`]contents-2["'`]\s*,\s*document\.querySelector\(\s*["'`]#page-turn-next["'`]\s*\)\s*,\s*["'`]next["'`]/,
    );
  });

  it("both Contents pages keep the identical physical page material and box, corner controls included", () => {
    const box1 = contents1!.doc.querySelector(".book-open.leaf");
    const box2 = contents2!.doc.querySelector(".book-open.leaf");
    expect(box1?.className).toBe(box2?.className);
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
