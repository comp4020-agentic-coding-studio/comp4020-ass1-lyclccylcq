import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAdjacent, mount, relativeHref, TURN_STORAGE_KEY } from "./book-nav";

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
    expect(getAdjacent("closing").prev?.id).toBe("illegal-moves");
  });

  it("a middle chapter's neighbours are the chapters either side of it", () => {
    const adjacent = getAdjacent("connected-groups");
    expect(adjacent.prev?.id).toBe("liberties-and-capture");
    expect(adjacent.next?.id).toBe("illegal-moves");
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
