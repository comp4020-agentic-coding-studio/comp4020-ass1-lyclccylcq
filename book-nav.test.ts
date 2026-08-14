import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdjacent, mount, mountPageTurn, relativeHref, TURN_STORAGE_KEY } from "./book-nav";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getAdjacent", () => {
  it("the cover has no previous page", () => {
    expect(getAdjacent("cover").prev).toBeNull();
    expect(getAdjacent("cover").next?.id).toBe("contents");
  });

  it("the closing page has no next page", () => {
    expect(getAdjacent("closing").next).toBeNull();
    expect(getAdjacent("closing").prev?.id).toBe("free-play");
  });

  it("endgame sits between ko and scoring", () => {
    const adjacent = getAdjacent("endgame");
    expect(adjacent.prev?.id).toBe("ko");
    expect(adjacent.next?.id).toBe("scoring");
  });

  it("free play follows the last chapter, and going back from it lands on scoring", () => {
    expect(getAdjacent("scoring").next?.id).toBe("free-play");
    expect(getAdjacent("free-play").prev?.id).toBe("scoring");
  });

  it("a middle chapter's neighbours are the chapters either side of it", () => {
    const adjacent = getAdjacent("connected-groups");
    expect(adjacent.prev?.id).toBe("liberties-and-capture");
    expect(adjacent.next?.id).toBe("illegal-moves");
  });

  it("the prologue sits between contents-2 and the first chapter", () => {
    const adjacent = getAdjacent("prologue");
    expect(adjacent.prev?.id).toBe("contents-2");
    expect(adjacent.next?.id).toBe("placing-stones");
  });

  it("contents' next page is contents-2, never skipped", () => {
    const adjacent = getAdjacent("contents");
    expect(adjacent.next?.id).toBe("contents-2");
  });

  it("contents-2 sits between contents and the prologue", () => {
    const adjacent = getAdjacent("contents-2");
    expect(adjacent.prev?.id).toBe("contents");
    expect(adjacent.next?.id).toBe("prologue");
  });

  it("the first chapter's previous page is the prologue, not contents", () => {
    expect(getAdjacent("placing-stones").prev?.id).toBe("prologue");
  });

  it("returns no neighbours for an unknown id", () => {
    expect(getAdjacent("nope")).toEqual({ prev: null, next: null });
  });
});

describe("relativeHref", () => {
  it("links between two chapter pages stay in the same directory", () => {
    expect(relativeHref("lessons/placing-stones.html", "lessons/liberties-and-capture.html")).toBe(
      "./liberties-and-capture.html",
    );
  });

  it("links from a chapter page up to a root page", () => {
    expect(relativeHref("lessons/illegal-moves.html", "contents.html")).toBe("../contents.html");
  });

  it("links from a root page down into a chapter page", () => {
    expect(relativeHref("closing.html", "lessons/illegal-moves.html")).toBe("./lessons/illegal-moves.html");
  });
});

function setUpBookNav(): { doc: Document; window: JSDOM["window"] } {
  const dom = new JSDOM(`<!doctype html><body><footer><nav id="book-nav"></nav></footer></body>`, {
    url: "https://example.test/lessons/connected-groups.html",
  });
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("window", dom.window);
  return { doc: dom.window.document, window: dom.window };
}

describe("mount", () => {
  it("renders a working prev and next link for a mid-book chapter", () => {
    const { doc } = setUpBookNav();
    mount("connected-groups", doc.querySelector("#book-nav"));

    const prev = doc.querySelector<HTMLAnchorElement>(".book-nav-prev");
    const next = doc.querySelector<HTMLAnchorElement>(".book-nav-next");
    expect(prev?.getAttribute("href")).toBe("./liberties-and-capture.html");
    expect(next?.getAttribute("href")).toBe("./illegal-moves.html");
  });

  it("renders a working prev and next link for the prologue, a root-level page", () => {
    const dom = new JSDOM(`<!doctype html><body><footer><nav id="book-nav"></nav></footer></body>`, {
      url: "https://example.test/prologue.html",
    });
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);

    mount("prologue", dom.window.document.querySelector("#book-nav"));

    const prev = dom.window.document.querySelector<HTMLAnchorElement>(".book-nav-prev");
    const next = dom.window.document.querySelector<HTMLAnchorElement>(".book-nav-next");
    expect(prev?.getAttribute("href")).toBe("./contents-2.html");
    expect(next?.getAttribute("href")).toBe("./lessons/placing-stones.html");
  });

  it("renders the working footer between the two Contents pages, in order", () => {
    const { doc } = setUpBookNav();

    mount("contents", doc.querySelector("#book-nav"));
    expect(doc.querySelector<HTMLAnchorElement>(".book-nav-prev")?.getAttribute("href")).toBe(
      "./index.html",
    );
    expect(doc.querySelector<HTMLAnchorElement>(".book-nav-next")?.getAttribute("href")).toBe(
      "./contents-2.html",
    );

    mount("contents-2", doc.querySelector("#book-nav"));
    expect(doc.querySelector<HTMLAnchorElement>(".book-nav-prev")?.getAttribute("href")).toBe(
      "./contents.html",
    );
    expect(doc.querySelector<HTMLAnchorElement>(".book-nav-next")?.getAttribute("href")).toBe(
      "./prologue.html",
    );
  });

  it("omits the next link on the last page, and the prev link on the first", () => {
    const { doc } = setUpBookNav();
    mount("closing", doc.querySelector("#book-nav"));
    expect(doc.querySelector(".book-nav-next")).toBeNull();
    expect(doc.querySelector(".book-nav-prev")).not.toBeNull();

    mount("cover", doc.querySelector("#book-nav"));
    expect(doc.querySelector(".book-nav-prev")).toBeNull();
  });

  it("does nothing when the container is missing", () => {
    expect(() => mount("connected-groups", null)).not.toThrow();
  });

  it("does nothing when the id isn't a known page", () => {
    const { doc } = setUpBookNav();
    mount("nope", doc.querySelector("#book-nav"));
    expect(doc.querySelector("#book-nav")?.children).toHaveLength(0);
  });

  it("tags the intended direction into sessionStorage on click, without preventing navigation", () => {
    const { doc, window } = setUpBookNav();
    mount("connected-groups", doc.querySelector("#book-nav"));

    const next = doc.querySelector<HTMLAnchorElement>(".book-nav-next");
    const event = new window.Event("click", { bubbles: true, cancelable: true });
    next?.dispatchEvent(event);

    expect(window.sessionStorage.getItem(TURN_STORAGE_KEY)).toBe("next");
    expect(event.defaultPrevented).toBe(false);
  });

  it("a second rapid click on the same link is swallowed instead of re-tagging", () => {
    const { doc, window } = setUpBookNav();
    mount("connected-groups", doc.querySelector("#book-nav"));

    const next = doc.querySelector<HTMLAnchorElement>(".book-nav-next");
    next?.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    window.sessionStorage.removeItem(TURN_STORAGE_KEY);

    const secondClick = new window.Event("click", { bubbles: true, cancelable: true });
    next?.dispatchEvent(secondClick);

    expect(secondClick.defaultPrevented).toBe(true);
    expect(window.sessionStorage.getItem(TURN_STORAGE_KEY)).toBeNull();
  });
});

// mountPageTurn backs the Contents pages' bottom-corner controls (§ two-
// Contents-page spec): same adjacency/href/sessionStorage-tag mechanics as
// mount, but a single caller-labelled link per call instead of a derived
// "‹ Title"/"Title ›" pair — needed because contents and contents-2 share the
// literal title "Contents", which made the generic footer's Next link read
// as just "Contents ›" and gave no visible sign that a second page existed.
describe("mountPageTurn", () => {
  function setUpCorner(url: string): { doc: Document; window: JSDOM["window"] } {
    const dom = new JSDOM(`<!doctype html><body><div id="page-turn-next"></div><div id="page-turn-prev"></div></body>`, {
      url,
    });
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("window", dom.window);
    return { doc: dom.window.document, window: dom.window };
  }

  it("renders a labelled forward link from contents to contents-2", () => {
    const { doc } = setUpCorner("https://example.test/contents.html");
    mountPageTurn("contents", doc.querySelector("#page-turn-next"), "next", "续 ›");

    const link = doc.querySelector<HTMLAnchorElement>("#page-turn-next .page-turn-next");
    expect(link?.textContent).toBe("续 ›");
    expect(link?.getAttribute("href")).toBe("./contents-2.html");
  });

  it("renders labelled prev and next links from contents-2", () => {
    const { doc } = setUpCorner("https://example.test/contents-2.html");
    mountPageTurn("contents-2", doc.querySelector("#page-turn-prev"), "prev", "‹ 前页");
    mountPageTurn("contents-2", doc.querySelector("#page-turn-next"), "next", "序章 ›");

    const prev = doc.querySelector<HTMLAnchorElement>("#page-turn-prev .page-turn-prev");
    const next = doc.querySelector<HTMLAnchorElement>("#page-turn-next .page-turn-next");
    expect(prev?.textContent).toBe("‹ 前页");
    expect(prev?.getAttribute("href")).toBe("./contents.html");
    expect(next?.textContent).toBe("序章 ›");
    expect(next?.getAttribute("href")).toBe("./prologue.html");
  });

  it("leaves the container empty when there's no neighbour in that direction", () => {
    const { doc } = setUpCorner("https://example.test/index.html");
    mountPageTurn("cover", doc.querySelector("#page-turn-prev"), "prev", "‹ back");
    expect(doc.querySelector("#page-turn-prev")?.children).toHaveLength(0);
  });

  it("does nothing when the container is missing", () => {
    expect(() => mountPageTurn("contents", null, "next", "续 ›")).not.toThrow();
  });

  it("does nothing when the id isn't a known page", () => {
    const { doc } = setUpCorner("https://example.test/contents.html");
    mountPageTurn("nope", doc.querySelector("#page-turn-next"), "next", "续 ›");
    expect(doc.querySelector("#page-turn-next")?.children).toHaveLength(0);
  });

  it("tags the direction into sessionStorage on click, without preventing navigation", () => {
    const { doc, window } = setUpCorner("https://example.test/contents.html");
    mountPageTurn("contents", doc.querySelector("#page-turn-next"), "next", "续 ›");

    const link = doc.querySelector<HTMLAnchorElement>(".page-turn-next");
    const event = new window.Event("click", { bubbles: true, cancelable: true });
    link?.dispatchEvent(event);

    expect(window.sessionStorage.getItem(TURN_STORAGE_KEY)).toBe("next");
    expect(event.defaultPrevented).toBe(false);
  });

  it("a second rapid click on the same link is swallowed instead of re-tagging", () => {
    const { doc, window } = setUpCorner("https://example.test/contents.html");
    mountPageTurn("contents", doc.querySelector("#page-turn-next"), "next", "续 ›");

    const link = doc.querySelector<HTMLAnchorElement>(".page-turn-next");
    link?.dispatchEvent(new window.Event("click", { bubbles: true, cancelable: true }));
    window.sessionStorage.removeItem(TURN_STORAGE_KEY);

    const secondClick = new window.Event("click", { bubbles: true, cancelable: true });
    link?.dispatchEvent(secondClick);

    expect(secondClick.defaultPrevented).toBe(true);
    expect(window.sessionStorage.getItem(TURN_STORAGE_KEY)).toBeNull();
  });
});
